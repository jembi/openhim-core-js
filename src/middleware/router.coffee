util = require 'util'
zlib = require 'zlib'
http = require 'http'
https = require 'https'
net = require 'net'
tls = require 'tls'
Q = require 'q'
config = require '../config/config'
config.mongo = config.get('mongo')
config.router = config.get('router')
logger = require "winston"
status = require "http-status"
cookie = require 'cookie'
fs = require 'fs'
Keystore = require("../model/keystore").Keystore

containsMultiplePrimaries = (routes) ->
  numPrimaries = 0
  for route in routes
    numPrimaries++ if route.primary
  return numPrimaries > 1

setKoaResponse = (ctx, response) ->
  ctx.response.status = response.status
  ctx.response.timestamp = response.timestamp
  ctx.response.body = response.body

  if not ctx.response.header
    ctx.response.header = {}

  for key, value of response.headers
    switch key.toLowerCase()
      when 'set-cookie' then setCookiesOnContext ctx, value
      when 'location' then ctx.response.redirect value if response.status >= 300 and response.status < 400
      when 'content-type' then ctx.response.type = value
      else
        try
          if key != 'content-encoding' # Strip the content encoding header
            ctx.response.set key, value
        catch err
          logger.error err

if process.env.NODE_ENV == "test"
  exports.setKoaResponse = setKoaResponse

setCookiesOnContext = (ctx, value) ->
  logger.info 'Setting cookies on context'
  for c_key,c_value in value
    c_opts = {path:false,httpOnly:false} #clear out default values in cookie module
    c_vals = {}
    for p_key,p_val of cookie.parse c_key
      p_key_l = p_key.toLowerCase()
      switch p_key_l
        when 'max-age' then c_opts['maxage'] = parseInt p_val, 10
        when 'expires' then c_opts['expires'] = new Date p_val
        when 'path','domain','secure','signed','overwrite' then c_opts[p_key_l] = p_val
        when 'httponly' then c_opts['httpOnly'] = p_val
        else c_vals[p_key] = p_val
    for p_key,p_val of c_vals
      ctx.cookies.set p_key,p_val,c_opts

handleServerError = (ctx, err) ->
  ctx.response.status = status.INTERNAL_SERVER_ERROR
  ctx.response.timestamp = new Date()
  ctx.response.body = "An internal server error occurred"
  logger.error "Internal server error occured: #{err} "
  logger.error "#{err.stack}" if err.stack


sendRequestToRoutes = (ctx, routes, next) ->
  promises = []

  if containsMultiplePrimaries routes
    return next new Error "Cannot route transaction: Channel contains multiple primary routes and only one primary is allowed"

  Keystore.findOne {}, (err, keystore) ->

    for route in routes
      path = getDestinationPath route, ctx.path
      options =
        hostname: route.host
        port: route.port
        path: path
        method: ctx.request.method
        headers: ctx.request.header
        agent: false
        rejectUnauthorized: true
        key: keystore.key
        cert: keystore.cert.data
        secureProtocol: 'TLSv1_method'

      if route.cert?
        options.ca = keystore.ca.id(route.cert).data

      if ctx.request.querystring
        options.path += '?' + ctx.request.querystring

      if options.headers && options.headers.authorization
        delete options.headers.authorization

      if route.username and route.password
        options.auth = route.username + ":" + route.password

      if options.headers && options.headers.host
        delete options.headers.host

      if route.primary
        promise = sendRequest(ctx, route, options)
        .then (response) ->
          if response.headers?['content-type']?.indexOf('application/json+openhim') > -1
            # handle mediator reponse
            responseObj = JSON.parse response.body
            ctx.mediatorResponse = responseObj
            # then set koa response from responseObj.response
            setKoaResponse ctx, responseObj.response
          else
            setKoaResponse ctx, response
        .fail (reason) ->
          # on failure
          handleServerError ctx, reason
      else
        promise = buildNonPrimarySendRequestPromise ctx, route, options, path

      promises.push promise

    (Q.all promises).then ->
      next()

# function to build fresh promise for transactions routes
buildNonPrimarySendRequestPromise = (ctx, route, options, path) ->
  sendRequest ctx, route, options
  .then (response) ->
    routeObj = {}
    routeObj.name = route.name
    routeObj.request =
      path: path
      headers: ctx.request.header
      querystring: ctx.request.querystring
      method: ctx.request.method
      timestamp: ctx.requestTimestamp

    if response.headers?['content-type']?.indexOf('application/json+openhim') > -1
      # handle mediator reponse
      responseObj = JSON.parse response.body
      routeObj.orchestrations = responseObj.orchestrations
      routeObj.properties = responseObj.properties
      routeObj.response = responseObj.response
    else
      routeObj.response = response

    ctx.routes = [] if not ctx.routes
    ctx.routes.push routeObj
  .fail (reason) ->
    # on failure
    handleServerError ctx, reason

sendRequest = (ctx, route, options) ->
  if route.type is 'tcp' or route.type is 'mllp'
    logger.info 'Routing socket request'
    return sendSocketRequest ctx, route, options
  else
    logger.info 'Routing http(s) request'
    return sendHttpRequest ctx, route, options

obtainCharset = (headers) ->
  contentType = headers['content-type'] || ''
  matches =  contentType.match(/charset=([^;,\r\n]+)/i)
  if (matches && matches[1])
    return matches[1]
  return  'utf-8'

###
# A promise returning function that send a request to the given route and resolves
# the returned promise with a response object of the following form:
#   response =
#    status: <http_status code>
#    body: <http body>
#    headers: <http_headers_object>
#    timestamp: <the time the response was recieved>
###
sendHttpRequest = (ctx, route, options) ->
  defered = Q.defer()
  response = {}

  gunzip = zlib.createGunzip()
  inflate = zlib.createInflate()

  method = http

  if route.secured
    method = https

  routeReq = method.request options, (routeRes) ->
    response.status = routeRes.statusCode
    response.headers = routeRes.headers

    uncompressedBodyBufs = []
    if routeRes.headers['content-encoding'] == 'gzip' #attempt to gunzip
      routeRes.pipe gunzip

      gunzip.on "data", (data) ->
        uncompressedBodyBufs.push data
        return

    if routeRes.headers['content-encoding'] == 'deflate' #attempt to inflate
      routeRes.pipe inflate

      inflate.on "data", (data) ->
        uncompressedBodyBufs.push data
        return

    bufs = []
    routeRes.on "data", (chunk) ->
      bufs.push chunk

    # See https://www.exratione.com/2014/07/nodejs-handling-uncertain-http-response-compression/
    routeRes.on "end", ->
      response.timestamp = new Date()
      charset = obtainCharset(routeRes.headers)
      if routeRes.headers['content-encoding'] == 'gzip'
        gunzip.on "end", ->
          uncompressedBody =  Buffer.concat uncompressedBodyBufs
          response.body = uncompressedBody.toString charset
          if not defered.promise.isRejected()
            defered.resolve response
          return

      else if routeRes.headers['content-encoding'] == 'deflate'
        inflate.on "end", ->
          uncompressedBody =  Buffer.concat uncompressedBodyBufs
          response.body = uncompressedBody.toString charset
          if not defered.promise.isRejected()
            defered.resolve response
          return

      else
        response.body = Buffer.concat bufs
        if not defered.promise.isRejected()
          defered.resolve response

  routeReq.on "error", (err) -> defered.reject err

  routeReq.setTimeout config.router.timeout, -> defered.reject "Request Timed Out"

  if ctx.request.method == "POST" || ctx.request.method == "PUT"
    routeReq.write ctx.body

  routeReq.end()

  return defered.promise

###
# A promise returning function that send a request to the given route using sockets and resolves
# the returned promise with a response object of the following form: ()
#   response =
#    status: <200 if all work, else 500>
#    body: <the received data from the socket>
#    timestamp: <the time the response was recieved>
#
# Supports both normal and MLLP sockets
###
sendSocketRequest = (ctx, route, options) ->
  mllpEndChar = String.fromCharCode(0o034)

  defered = Q.defer()
  requestBody = ctx.body
  response = {}

  method = net
  if route.secured
    method = tls

  options =
    host: options.hostname
    port: options.port
    rejectUnauthorized: options.rejectUnauthorized
    key: options.key
    cert: options.cert
    secureProtocol: options.secureProtocol
    ca: options.ca

  client = method.connect options, ->
    logger.info "Opened #{route.type} connection to #{options.host}:#{options.port}"
    if route.type is 'tcp'
      client.end requestBody
    else if route.type is 'mllp'
      client.write requestBody
    else
      logger.error "Unkown route type #{route.type}"

  bufs = []
  client.on 'data', (chunk) ->
    bufs.push chunk
    if route.type is 'mllp' and chunk.toString().indexOf(mllpEndChar) > -1
      logger.debug 'Received MLLP response end character'
      client.end()

  client.on 'error', (err) -> defered.reject err

  client.on 'end', ->
    logger.info "Closed #{route.type} connection to #{options.host}:#{options.port}"

    if route.secured and not client.authorized
      return defered.reject new Error 'Client authorization failed'
    response.body = Buffer.concat bufs
    response.status = status.OK
    response.timestamp = new Date()
    if not defered.promise.isRejected()
      defered.resolve response

  return defered.promise

getDestinationPath = (route, requestPath) ->
  if route.path
    route.path
  else if route.pathTransform
    transformPath requestPath, route.pathTransform
  else
    requestPath

###
# Applies a sed-like expression to the path string
#
# An expression takes the form s/from/to
# Only the first 'from' match will be substituted
# unless the global modifier as appended: s/from/to/g
#
# Slashes can be escaped as \/
###
exports.transformPath = transformPath = (path, expression) ->
  # replace all \/'s with a temporary ':' char so that we don't split on those
  # (':' is safe for substitution since it cannot be part of the path)
  sExpression = expression.replace /\\\//g, ':'
  sub = sExpression.split '/'

  from = sub[1].replace /:/g, '\/'
  to = if sub.length > 2 then sub[2] else ""
  to = to.replace /:/g, '\/'

  if sub.length > 3 and sub[3] is 'g'
    fromRegex = new RegExp from, 'g'
  else
    fromRegex = new RegExp from

  path.replace fromRegex, to


###
# Gets the authorised channel and routes
# the request to all routes within that channel. It updates the
# response of the context object to reflect the response recieved from the
# route that is marked as 'primary'.
#
# Accepts (ctx, next) where ctx is a [Koa](http://koajs.com/) context
# object and next is a callback that is called once the route marked as
# primary has returned an the ctx.response object has been updated to
# reflect the response from that route.
###
exports.route = (ctx, next) ->
  channel = ctx.authorisedChannel
  sendRequestToRoutes ctx, channel.routes, next

###
# The [Koa](http://koajs.com/) middleware function that enables the
# router to work with the Koa framework. CoffeeScript does not support
# ES6 generators yet so this function has to be passed through as pure
# Javascript.
#
# Use with: app.use(router.koaMiddleware)
###
exports.koaMiddleware = `function *routeMiddleware(next) {
  var route = Q.denodeify(exports.route);
  yield route(this);
  yield next;
}`
