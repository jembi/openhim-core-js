koa = require 'koa'
route = require 'koa-route'
cors = require 'koa-cors'
router = require './middleware/router'
bodyParser = require 'koa-body-parser'
clients = require './api/clients'
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
	app.use route.get '/clients', clients.getClients
	app.use route.get '/clients/:clientId', clients.findClientById
	app.use route.post '/clients', clients.addClient
	app.use route.get '/clients/domain/:domain', clients.findClientByDomain
	app.use route.put '/clients/:clientId', clients.updateClient
	app.use route.delete '/clients/:clientId', clients.removeClient

	app.use route.get '/transactions', transactions.getTransactions
	app.use route.post '/transactions', transactions.addTransaction
	app.use route.get '/transactions/:transactionId', transactions.getTransactionById	 
	app.use route.get '/transactions/apps/:clientId', transactions.findTransactionByClientId

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

