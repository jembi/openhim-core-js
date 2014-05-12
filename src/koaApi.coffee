koa = require 'koa'
route = require 'koa-route'
cors = require 'koa-cors'
router = require './router'
bodyParser = require 'koa-body-parser'
applications = require './api/applications'
transactions = require './api/transactions'
channels = require './api/channels'
monitor = require './api/monitor'
Q = require 'q'

exports.setupApp = (done) ->
	
	# Create an instance of the koa-server and add a body-parser
	app = koa()
	app.use cors()
	app.use bodyParser()

	# Define the api routes
	app.use route.get '/applications', applications.getApplications
	app.use route.get '/applications/:applicationId', applications.getApplication

	app.use route.get '/transactions', transactions.getTransactions

	app.use route.get '/channels', channels.getChannels
	app.use route.post '/channels', channels.addChannel
	app.use route.get '/channels/:channelName', channels.getChannel
	app.use route.put '/channels/:channelName', channels.updateChannel
	app.use route.delete '/channels/:channelName', channels.removeChannel
	
	app.use route.get '/monitor', monitor.getMonitor

	# Return the result
	done(app)