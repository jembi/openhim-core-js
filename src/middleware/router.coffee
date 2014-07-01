http = require 'http'
async = require 'async'
MongoClient = require('mongodb').MongoClient;
Q = require 'q'
config = require '../config/config'
config.mongo = config.get('mongo')
logger = require "winston"

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
		path = getDestinationPath route, ctx.request.url
		options =
			hostname: route.host
			port: route.port
			path: path
			method: ctx.request.method
			headers: ctx.request.header

		if ctx.request.querystring
			options.path += '?' + ctx.request.querystring
		
		if route.username and route.password
			options.auth = route.username+":"+route.password

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

		promises.push sendRequest ctx, response, options

	(Q.all promises).then -> next()

sendRequest = (ctx, responseDst, options) ->
	deferred = Q.defer()

	routeReq = http.request options, (routeRes) ->
		responseDst.status = routeRes.statusCode
		responseDst.header = routeRes.headers

		responseDst.body = ''
		routeRes.on "data", (chunk) -> responseDst.body += chunk

		routeRes.on "end", ->
			responseDst.timestamp = new Date()
			deferred.resolve()

	routeReq.on "error", (err) -> deferred.reject err

	if ctx.request.method == "POST" || ctx.request.method == "PUT"
		routeReq.write ctx.request.body
	routeReq.end()

	return deferred.promise

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
	to = if sub.length>2 then sub[2] else ""
	to = to.replace /:/g, '\/'

	if sub.length>3 and sub[3] is 'g'
		fromRegex = new RegExp from, 'g'
	else
		fromRegex = new RegExp from

	path.replace fromRegex, to


###
# Finds the channels that match the request in ctx.request and routes
# the request to all routes within those channels. It updates the
# response of the context object to reflect the response recieved from the
# route that is marked as 'primary'.
#
# Accepts (ctx, next) where ctx is a [Koa](http://koajs.com/) context
# object and next is a callback that is called once the route marked as
# primary has returned an the ctx.response object has been updated to
# reflect the response from that route.
###
exports.route = (ctx, next) ->
	routes = []
	for channel in ctx.authorisedChannels
		pat = new RegExp channel.urlPattern
		if pat.test ctx.request.url
			routes = routes.concat channel.routes

	sendRequestToRoutes ctx, routes, next

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
