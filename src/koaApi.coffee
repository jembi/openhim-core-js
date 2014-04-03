koa = require 'koa'
route = require 'koa-route'
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
	app.use bodyParser()

	
	# Define the api routes
	app.use route.get '/applications', applications.getApplications
	app.use route.get '/applications/:applicationId', applications.findApplicationById
	app.use route.post '/applications', applications.addApplication
	app.use route.get '/applications/domain/:domain', applications.findApplicationByDomain
	app.use route.put '/applications/:applicationId', applications.updateApplication
	app.use route.delete '/applications/:applicationId', applications.removeApplication

	app.use route.get '/transactions', transactions.getTransactions
	app.use route.post '/transactions', transactions.addTransaction
	app.use route.get '/transactions/:transactionId', transactions.getTransactionById	 
	app.use route.get '/transactions/apps/:applicationId', transactions.findTransactionByApplicationId

	app.use route.put '/transactions/:transactionId', transactions.updateTransaction
	app.use route.delete '/transactions/:transactionId', transactions.removeTransaction

	app.use route.get '/channels', channels.getChannels
	app.use route.post '/channels', channels.addChannel
	app.use route.get '/channels/:channelName', channels.getChannel
	app.use route.put '/channels/:channelName', channels.updateChannel
	app.use route.delete '/channels/:channelName', channels.removeChannel
	
	app.use route.get '/monitor', monitor.getMonitor


	# Return the result
	done(app)

