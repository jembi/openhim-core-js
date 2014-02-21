http = require 'http'
async = require 'async'
MongoClient = require('mongodb').MongoClient;

channelsCollection = null

getCollection = (done) ->
	if channelsCollection
		console.log "returning existing connection"
		return done channelsCollection
	else
		console.log "Connecting to Mongodb"
		MongoClient.connect 'mongodb://127.0.0.1:27017/test', (err, db) ->
			if err
				return done err

			db.createCollection 'channels', (err, collection) ->
				channelsCollection = collection
				return done collection

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

exports.getChannels = (done) ->
	getCollection (collection) ->
		console.log "About to search for channels"
		collection.find().toArray (err, items) ->
			if err
				return done err
			else
				return done null, items

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

exports.getChannel = (channelName, done) ->
	getCollection (collection) ->
		collection.findOne {name: channelName}, (err, item) ->
			if err
				done(err)
			else
				done null, item

exports.updateChannel = (channel, done) ->
	getCollection (collection) ->
		collection.update {name: channel.name}, channel, (err, result) ->
			if err
				done err
			else
				done()

exports.removeChannel = (channelName, done) ->
	getCollection (collection) ->
		collection.remove {name: channelName}, (err, numberOfRemoveDocs) ->
			if err
				return done err
			else
				return done()

sendRequestToRoutes = (req, res, routes, next) ->
	primaryRouteReturned = false

	console.log "Routes length: " + routes.length

	for route in routes
		console.log "Route: " + route.host + ", " + route.port + ", " + req.url + ", " + req.method
		options =
			hostname: route.host
			port: route.port
			path: req.url
			method: req.method

		routeReq = http.request options, (routeRes) ->
			console.log "Recieved response"
			if route.primary
				if primaryRouteReturned
					next new Error "A primary route has already been returned, only a single primary route is allowed"
				else
					routeRes.pipe res
					#routeRes.end()
					res.statusCode = routeRes.statusCode
					console.log "resCode: " + res.statusCode
					next()

		console.log "Making request"
		routeReq.end()

exports.route = (req, res, next) ->
	console.log "In route"

	routes = []

	exports.getChannels (err, items) ->
		console.log "fetched channels"
		if err
			return next err
		for channel in items
			pat = new RegExp channel.urlPattern
			if pat.test req.url
				console.log "Route matched!"
				routes = routes.concat channel.routes

		sendRequestToRoutes req, res, routes, next

