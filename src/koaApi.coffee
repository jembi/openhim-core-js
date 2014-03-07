koa = require 'koa'
route = require 'koa-route'
router = require './router'
applications = require './api/applications'
transactions = require './api/transactions'
channels = require './api/channels'
monitor = require './api/monitor'
Q = require 'q'

exports.setupApp = (done) ->
	
	# Create an instance of the koa-server
	app = koa()

	# Define the api routes
	app.use route.get '/applications', applications.getApplications
	app.use route.get '/applications/:applicationId', applications.getApplication

	app.use route.get '/transactions', transactions.getTransactions

	app.use route.get '/channels', channels.getChannels
	
	app.use route.get '/monitor', monitor.getMonitor

	# Return the result
	done(app)