http = require 'http'
async = require 'async'
MongoClient = require('mongodb').MongoClient;
Q = require 'q'
config = require '../config/config'
config.mongo = config.get('mongo')

sendRequestToRoutes = (ctx, routes, next) ->
	primaryRouteReturned = false
	
	for route in routes
		options =
			hostname: route.host
			port: route.port
			path: ctx.request.url
			method: ctx.request.method
			headers: ctx.request.header

		if ctx.request.querystring
			options.path += '?' + ctx.request.querystring
		
		if route.username and route.password
			options.auth = route.username+":"+route.password

		if options.headers && options.headers.host
			delete options.headers.host
		if route.primary
			routeReq = http.request options, (routeRes) ->
				if primaryRouteReturned
					next new Error "A primary route has already been returned, only a single primary route is allowed"
				else
					primaryRouteReturned = true
					ctx.response.status = routeRes.statusCode
					ctx.response.header = routeRes.headers
					routeRes.on "data", (chunk) ->
						ctx.response.body = chunk
					routeRes.on "end", ->
						next()
		else 
			routeReq = http.request options

		if ctx.request.method == "POST" || ctx.request.method == "PUT"
			routeReq.write ctx.request.body
		routeReq.end()

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
