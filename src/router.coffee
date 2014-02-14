http = require 'http'
async = require 'async'
MongoClient = require('mongodb').MongoClient;

channelsCollection = null

connectToDB = (done) ->
	if channelsCollection
		done channelsCollection
	else
		MongoClient.connect 'mongodb://127.0.0.1:27017/test', (err, db) ->
			if err
				return done err

			db.createCollection 'channels', (err, collection) ->
				channelsCollection = collection
				done collection

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
	connectToDB (collection) ->

		updateChannel = (channel, callback) ->
			collection.update {name: channel.name}, channel, {upsert: true}, (err, result) ->
				callback()

		async.map channels, updateChannel, (err, results) ->
			if err
				return done err
			else
				return done()

exports.getChannels = (done) ->
	connectToDB (collection) ->
		collection.find().toArray (err, items) ->
			if err
				done err
			else
				done null, items

exports.addChannel = (channel, done) ->
	connectToDB (collection) ->
		collection.find {name: channel.name}, {limit: 1}, (err, results) ->
			if err
				return done err
			results.count (err, count) ->
				if count == 0
					collection.insert channel, {safe: true}, (err, result) ->
						if err
							done err
						else
							done()
				else
					done new Error "Cannot add a channel with a name that is alreay in use"

exports.getChannel = (channelName, done) ->
	connectToDB (collection) ->
		collection.findOne {name: channelName}, (err, item) ->
			if err
				done(err)
			else
				done null, item

exports.updateChannel = (channel, done) ->
	connectToDB (collection) ->
		collection.update {name: channel.name}, channel, (err, result) ->
			if err
				done err
			else
				done()

exports.removeChannel = (channelName, somethingelse) ->
	connectToDB (collection) ->
		collection.remove {name: channelName}, (err, numberOfRemoveDocs) ->
			if err
				somethingelse err
				return
			else
				somethingelse()
				return

sendRequestToRoutes = (req, res, channel, next) ->
	primaryRouteReturned = false

	for route in routes
		options =
			hostname: route.host
			port: route.port
			path: req.url
			method: req.method

		routeReq = http.request options, (routeRes) ->
			if route.primary is true
				if primaryRouteReturned
					next new Error "A primary route has already been returned, only a single primary route is allowed"
				else
					routeRes.pipe res
					next()

		routeReq.end()

exports.route = (req, res, next) ->
	routes = []

	for channel in exports.getChannels()
		pat = new RegExp channel.urlPattern
		if pat.test req.url
			routes.concat channel.routes

	sendRequestToRoutes req, res, routes, next

