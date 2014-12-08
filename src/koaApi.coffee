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
contactGroups = require './api/contactGroups'
visualizer = require './api/visualizer'
Q = require 'q'
worker = require './api/worker'
mediators = require './api/mediators'
metrics = require './api/metrics'
serverRestart = require './restart'
statsd = require './model/statsd'

exports.setupApp = (done) ->

  # Create an instance of the koa-server and add a body-parser
  app = koa()
  app.use cors()
  app.use bodyParser()

  # Expose the authenticate route before the auth middleware so that it is publically accessible
  app.use route.get '/authenticate/:username', users.authenticate

  # Authenticate the API request
  #app.use authentication.authenticate

  # Define the api routes
  app.use route.get '/users', users.getUsers
  app.use route.get '/users/:email', users.getUser
  app.use route.post '/users', users.addUser
  app.use route.put '/users/:email', users.updateUser
  app.use route.delete '/users/:email', users.removeUser

  app.use route.get '/clients', clients.getClients
  app.use route.get '/clients/:clientId', clients.getClient
  app.use route.post '/clients', clients.addClient
  app.use route.get '/clients/domain/:clientDomain', clients.findClientByDomain
  app.use route.put '/clients/:clientId', clients.updateClient
  app.use route.delete '/clients/:clientId', clients.removeClient

  app.use route.get '/transactions', transactions.getTransactions
  app.use route.post '/transactions', transactions.addTransaction
  app.use route.get '/transactions/:transactionId', transactions.getTransactionById
  app.use route.get '/transactions/clients/:clientId', transactions.findTransactionByClientId
  app.use route.put '/transactions/:transactionId', transactions.updateTransaction
  app.use route.delete '/transactions/:transactionId', transactions.removeTransaction

  app.use route.get '/groups', contactGroups.getContactGroups
  app.use route.get '/groups/:contactGroupId', contactGroups.getContactGroup
  app.use route.post '/groups', contactGroups.addContactGroup
  app.use route.put '/groups/:contactGroupId', contactGroups.updateContactGroup
  app.use route.delete '/groups/:contactGroupId', contactGroups.removeContactGroup

  app.use route.get '/channels', channels.getChannels
  app.use route.post '/channels', channels.addChannel
  app.use route.get '/channels/:channelId', channels.getChannel
  app.use route.put '/channels/:channelId', channels.updateChannel
  app.use route.delete '/channels/:channelId', channels.removeChannel

  app.use route.get '/tasks', tasks.getTasks
  app.use route.post '/tasks', tasks.addTask
  app.use route.get '/tasks/:taskId', tasks.getTask
  app.use route.put '/tasks/:taskId', tasks.updateTask
  app.use route.delete '/tasks/:taskId', tasks.removeTask

  app.use route.get '/visualizer/events/:receivedTime', visualizer.getLatestEvents
  app.use route.get '/visualizer/sync', visualizer.sync

  app.use route.get '/metrics', metrics.getGlobalLoadTimeMetrics
  app.use route.get '/metrics/status', metrics.getGlobalStatusMetrics
  app.use route.get '/metrics/:type/:channelId', metrics.getChannelMetrics

  app.use route.get '/statsd', statsd.retrieveTransactionCount

  app.use route.get '/mediators', mediators.getAllMediators
  app.use route.get '/mediators/:uuid', mediators.getMediator
  app.use route.post '/mediators', mediators.addMediator

  # server restart endpoint
  app.use route.post '/restart', serverRestart.restart

  # Return the result
  done(app)
