http = require 'http'
async = require 'async'
MongoClient = require('mongodb').MongoClient;
Q = require "q"

channelsCollection = null

getCollection = (done) ->
	if channelsCollection
		return done channelsCollection
	else
		MongoClient.connect 'mongodb://127.0.0.1:27017/test', (err, db) ->
			if err
				return done err

			db.createCollection 'channels', (err, collection) ->
				channelsCollection = collection
				return done collection

###
# The Channel object that describes a specific channel within the OpenHIM.
# It provides some metadata describing a channel and contians a number of
# route objects. If a request matches the urlPattern of a channel it should
# be routed to each of the routes described in that channel.
#
# A channel also has an allow property. This property should contain a list
# of users or group that are authroised to send messages to this channel.
###
exports.Channel = (name, urlPattern, routes, allow, deny) ->
	this.name = name
	this.urlPattern = urlPattern
	this.routes = routes
	if allow
		this.allow = allow
	if deny
		this.deny = deny
exports.Channel.prototype.toString = ->
	return "<Channel: " + this.name + ">"
	
###
# Adds a number of channels to the router at once.
# 
# Accepts (channels, done) where channels is an array of Channel objects and
# done is a callabck that will be called once the channels have been saved or
# it will be called with an Error object if an error occurs.
###
exports.setChannels = (channels, done) ->
	getCollection (collection) ->

		updateChannel = (channel, callback) ->
			collection.update {name: channel.name}, channel, {upsert: true}, (err, result) ->
				callback()

		async.map channels, updateChannel, (err, results) ->
			if err
				return done err
			else
				return done()

###
# Gets all channel currently registered.
# 
# Accepts (done) where done is a callback that will be called with (err, items)
# err will contain an error object if an error occurs otherwise items will
# contain an array fo Channel objects.
###
exports.getChannels = (done) ->
	getCollection (collection) ->
		collection.find().toArray (err, items) ->
			if err
				return done err
			else
				return done null, items

###
# Adds a new channel.
# 
# Accepts (channel, done) where channel is a Channel object and done is a
# callback that will be called once the channel is saved. If an error occurs it
# will return an Error object.
###
exports.addChannel = (channel, done) ->
	getCollection (collection) ->
		collection.find {name: channel.name}, {limit: 1}, (err, results) ->
			if err
				return done err
			results.count (err, count) ->
				if count == 0
					collection.insert channel, {safe: true}, (err, result) ->
						if err
							return done err
						else
							return done()
				else
					return done new Error "Cannot add a channel with a name that is alreay in use"

###
# Fetches a specific channel by its name.
# 
# Accepts (channelName, done) where channelName is the name of the channel
# to fetch and done is a callback. The callback will be called with
# (err, channel). If an error occurrs err will be an Error object otherwise
# it will be null, channel will be a Channel object.
###
exports.getChannel = (channelName, done) ->
	getCollection (collection) ->
		collection.findOne {name: channelName}, (err, item) ->
			if err
				done(err)
			else
				done null, item

###
# Updates a channel with a newer version.
# 
# Accepts (channel, done) where channel is the channel to update as a
# Channel object and done is a callback. The callback will be called with
# an Error object is an error occurred.
###
exports.updateChannel = (channel, done) ->
	getCollection (collection) ->
		collection.update {name: channel.name}, channel, (err, result) ->
			if err
				done err
			else
				done()

###
# Removes a channel.
# 
# Accepts (channelName, done) where channelName is a
# String of the name of the channel to remove and done is a callback that
# is called once the channel is removed. The callback is called with an
# Error object is an error occurs.
###
exports.removeChannel = (channelName, done) ->
	getCollection (collection) ->
		collection.remove {name: channelName}, (err, numberOfRemoveDocs) ->
			if err
				return done err
			else
				return done()

sendRequestToRoutes = (ctx, routes, next) ->
	primaryRouteReturned = false
	
	for route in routes
		options =
			hostname: route.host
			port: route.port
			path: ctx.request.url
			method: ctx.request.method
			headers: ctx.request.header
		
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

	exports.getChannels (err, items) ->
		if err
			return next err
		for channel in items
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
