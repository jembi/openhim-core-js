koa = require 'koa'
route = require 'koa-route'
cors = require 'koa-cors'
router = require './middleware/router'
bodyParser = require 'koa-body-parser'
authentication = require './api/authentication'
users = require './api/users'
clients = require './api/clients'
transactions = require './api/transactions'
channels = require './api/channels'
tasks = require './api/tasks'
queue = require './api/queue'
monitor = require './api/monitor'
Q = require 'q'

exports.setupApp = (done) ->
	
	# Create an instance of the koa-server and add a body-parser
	app = koa()
	app.use cors()
	app.use bodyParser()

	# Expose the authenticate route before the auth middleware so that it is publically accessible
	app.use route.get '/authenticate/:username', users.authenticate

	# Authenticate the API request
	app.use authentication.authenticate
	
	# Define the api routes
	app.use route.get '/users', users.getUsers
	app.use route.get '/users/:email', users.getUser
	app.use route.post '/users', users.addUser
	app.use route.put '/users/:email', users.updateUser
	app.use route.delete '/users/:email', users.removeUser

	app.use route.get '/clients', clients.getClients
	app.use route.get '/clients/:clientId', clients.getClient
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

	app.use route.get '/tasks', tasks.getTasks
	app.use route.post '/tasks', tasks.addTask
	app.use route.get '/tasks/:taskId', tasks.getTask
	app.use route.put '/tasks/:taskId', tasks.updateTask
	app.use route.delete '/tasks/:taskId', tasks.removeTask

	app.use route.get '/queue', queue.getQueueItems
	app.use route.post '/queue', queue.addQueueItem
	app.use route.get '/queue/:queueId', queue.getQueueItem
	app.use route.delete '/queue/:queueId', queue.removeQueueItem
	
	app.use route.get '/monitor', monitor.getMonitor

	# Return the result
	done(app)

