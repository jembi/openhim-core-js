util = require('util');
zlib = require('zlib');
http = require 'http'
https = require 'https'
net = require 'net'
async = require 'async'
MongoClient = require('mongodb').MongoClient;
Q = require 'q'
config = require '../config/config'
config.mongo = config.get('mongo')
logger = require "winston"
status = require "http-status"

containsMultiplePrimaries = (routes) ->
	numPrimaries = 0
	for route in routes
		numPrimaries++ if route.primary
	return numPrimaries > 1

sendRequestToRoutes = (ctx, routes, next) ->
	promises = []

	if containsMultiplePrimaries routes
		return next new Error "Cannot route transaction: Channel contains multiple primary routes and only one primary is allowed"

	for route in routes
		path = getDestinationPath route, ctx.path
		options =
			hostname: route.host
			port: route.port
			path: path
			method: ctx.request.method
			headers: ctx.request.header
			agent: false
			rejectUnauthorized: false

		if ctx.request.querystring
			options.path += '?' + ctx.request.querystring

		if options.headers && options.headers.authorization
			delete options.headers.authorization

		if route.username and route.password
			options.auth = route.username + ":" + route.password

		if options.headers && options.headers.host
			delete options.headers.host

		if route.primary
			response = ctx.response
		else
			routeResponse = {}
			routeResponse.name = route.name
			routeResponse.request =
				path: path
				headers: ctx.request.header
				querystring: ctx.request.querystring
				method: ctx.request.method
			routeResponse.response = {}
			ctx.routes = [] if not ctx.routes
			ctx.routes.push routeResponse
			response = routeResponse.response

		secured = false #default to unsecured route

		if route.secured
			secured = true

		promises.push sendRequest ctx, route.type, response, options, secured

	(Q.all promises).then ->
		next()

sendRequest = (ctx, routeType, responseDst, options, secured) ->
	deferred = Q.defer()

	if routeType is 'tcp'
		logger.info 'Routing tcp request'
		sendSocketRequest ctx, responseDst, options, secured, deferred.resolve
	else
		logger.info 'Routing http(s) request'
		sendHttpRequest ctx, responseDst, options, secured, deferred.resolve

	return deferred.promise


obtainCharset = (headers) ->
        contentType = headers['content-type'] || ''
        matches =  contentType.match(/charset=([^;,\r\n]+)/i)
        if (matches && matches[1]) 
                return matches[1]
        return  'utf-8'


sendHttpRequest = (ctx, responseDst, options, secured, callback) ->
	method = http

	if secured
                method = https

	routeReq = method.request options, (routeRes) ->
		responseDst.status = routeRes.statusCode

		# copy across http headers
		if not responseDst.header
			responseDst.header = {}
		for key, value of routeRes.headers
			switch key
				when 'location' then responseDst.redirect(value)
				else responseDst.header[key] = value

		responseDst.body = new Buffer(0)
		bufs = []
		routeRes.on "data", (chunk) ->
                        bufs.push chunk


                #See https://www.exratione.com/2014/07/nodejs-handling-uncertain-http-response-compression/
		routeRes.on "end", ->
                        responseDst.timestamp = new Date()
                        charset = obtainCharset(routeRes.headers)
                        if (routeRes.headers['content-encoding'] == 'gzip')
                                console.log('gzip')
                                zlib.gunzip(
                                        Buffer.concat(bufs),
                                        (gunzipError, buf)->
                                                if (gunzipError) then console.log(gunzipError)
                                                else responseDst.body = buf.toString(charset)
                                )
                        else if (routeRes.headers['content-encoding'] == 'deflate')
                                console.log('deflate')
                                zlib.inflate(
                                        Buffer.concat(bufs),
                                        (inflateError, buf)->
                                                if (inflateError) then console.log(inflateError)
                                                else responseDst.body = buf.toString(charset)
                                )
                        else
                                responseDst.body = Buffer.concat(bufs)
			callback()

	routeReq.on "error", (err) ->
		responseDst.status = status.INTERNAL_SERVER_ERROR
		responseDst.timestamp = new Date()

		logger.error err
		callback()

	if ctx.request.method == "POST" || ctx.request.method == "PUT"
		routeReq.write ctx.body

	routeReq.end()

sendSocketRequest = (ctx, responseDst, options, secured, callback) ->
	requestBody = ctx.body
	client = new net.Socket()
	responseDst.body = ''

	client.connect options.port, options.hostname, ->
		logger.info "Opened tcp connection to #{options.hostname}:#{options.port}"
		client.write requestBody

	client.on 'data', (chunk) ->
		responseDst.status = status.OK
		responseDst.body += chunk
		responseDst.timestamp = new Date()
		client.end()
		callback()

	client.on 'error', (err) ->
		responseDst.status = status.INTERNAL_SERVER_ERROR
		responseDst.timestamp = new Date()

		logger.error err
		callback()


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
