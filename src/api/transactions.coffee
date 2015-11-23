transactions = require '../model/transactions'
events = require '../middleware/events'
Channel = require('../model/channels').Channel
Client = require('../model/clients').Client
Q = require 'q'
logger = require 'winston'
authorisation = require './authorisation'
utils = require "../utils"
config = require '../config/config'
statsd_client = require "statsd-client"
statsd_server = config.get 'statsd'
sdc = new statsd_client statsd_server
application = config.get 'application'
os = require "os"
timer = new Date()
domain = os.hostname() + '.' + application.name

getChannelIDsArray = (channels) ->
  channelIDs = []
  for channel in channels
    channelIDs.push channel._id.toString()
  return channelIDs


# function to construct projection object
getProjectionObject = (filterRepresentation) ->
  switch filterRepresentation
    when "simpledetails"
      # view minimum required data for transaction details view
      return { "request.body": 0, "response.body": 0, "routes.request.body": 0, "routes.response.body": 0, "orchestrations.request.body": 0, "orchestrations.response.body": 0 }
    when "full"
      # view all transaction data
      return {}
    when "bulkrerun"
      # view only 'bulkrerun' properties
      return { "_id": 1, "childIDs": 1, "canRerun": 1, "channelID": 1 }
    else
      # no filterRepresentation supplied - simple view
      # view minimum required data for transactions
      return { "request.body": 0, "request.headers": 0, "response.body": 0, "response.headers": 0, orchestrations: 0, routes: 0 }




###
# Retrieves the list of transactions
###

exports.getTransactions = ->
  try

    filtersObject = this.request.query

    #get limit and page values
    filterLimit = filtersObject.filterLimit
    filterPage = filtersObject.filterPage
    filterRepresentation = filtersObject.filterRepresentation

    #remove limit/page/filterRepresentation values from filtersObject (Not apart of filtering and will break filter if present)
    delete filtersObject.filterLimit
    delete filtersObject.filterPage
    delete filtersObject.filterRepresentation

    #determine skip amount
    filterSkip = filterPage*filterLimit
    
    # get filters object
    filters = if filtersObject.filters? then JSON.parse filtersObject.filters else {}

    # Test if the user is authorised
    if not authorisation.inGroup 'admin', this.authenticated
      # if not an admin, restrict by transactions that this user can view
      channels = yield authorisation.getUserViewableChannels this.authenticated

      if not filtersObject.channelID
        filters.channelID = $in: getChannelIDsArray channels

      else if filtersObject.channelID not in getChannelIDsArray channels
        return utils.logAndSetResponse this, 403, "Forbidden: Unauthorized channel #{filtersObject.channelID}", 'info'

      # set 'filterRepresentation' to default if user isnt admin
      filterRepresentation = ''

    # get projection object
    projectionFiltersObject = getProjectionObject filterRepresentation


    if filtersObject.channelID
      filters.channelID = filtersObject.channelID

    # parse date to get it into the correct format for querying
    if filters['request.timestamp']
      filters['request.timestamp'] = JSON.parse filters['request.timestamp']
 

    ### Transaction Filters ###
    # build RegExp for transaction request path filter
    if filters['request.path']
      filters['request.path'] = new RegExp filters['request.path'], "i"

    # build RegExp for transaction request querystring filter
    if filters['request.querystring']
      filters['request.querystring'] = new RegExp filters['request.querystring'], "i"

    # response status pattern match checking
    if filters['response.status'] && utils.statusCodePatternMatch( filters['response.status'] )
      filters['response.status'] = "$gte": filters['response.status'][0]*100, "$lt": filters['response.status'][0]*100+100

    # check if properties exist
    if filters['properties']
      # we need to source the property key and re-construct filter
      key = Object.keys(filters['properties'])[0]
      filters['properties.'+key] = filters['properties'][key]

      # if property has no value then check if property exists instead
      if filters['properties'][key] is null
        filters['properties.'+key] = { '$exists': true }

      # delete the old properties filter as its not needed
      delete filters['properties']

    # parse childIDs.0 query to get it into the correct format for querying
    # .0 is first index of array - used to validate if empty or not
    if filters['childIDs.0']
      filters['childIDs.0'] = JSON.parse filters['childIDs.0']



    ### Route Filters ###
    # build RegExp for route request path filter
    if filters['routes.request.path']
      filters['routes.request.path'] = new RegExp filters['routes.request.path'], "i"

    # build RegExp for transaction request querystring filter
    if filters['routes.request.querystring']
      filters['routes.request.querystring'] = new RegExp filters['routes.request.querystring'], "i"

    # route response status pattern match checking
    if filters['routes.response.status'] && utils.statusCodePatternMatch( filters['routes.response.status'] )
      filters['routes.response.status'] = "$gte": filters['routes.response.status'][0]*100, "$lt": filters['routes.response.status'][0]*100+100



    ### orchestration Filters ###
    # build RegExp for orchestration request path filter
    if filters['orchestrations.request.path']
      filters['orchestrations.request.path'] = new RegExp filters['orchestrations.request.path'], "i"

    # build RegExp for transaction request querystring filter
    if filters['orchestrations.request.querystring']
      filters['orchestrations.request.querystring'] = new RegExp filters['orchestrations.request.querystring'], "i"

    # orchestration response status pattern match checking
    if filters['orchestrations.response.status'] && utils.statusCodePatternMatch( filters['orchestrations.response.status'] )
      filters['orchestrations.response.status'] = "$gte": filters['orchestrations.response.status'][0]*100, "$lt": filters['orchestrations.response.status'][0]*100+100

    

    # execute the query
    this.body = yield transactions.Transaction
      .find filters, projectionFiltersObject
      .skip filterSkip
      .limit filterLimit
      .sort 'request.timestamp': -1
      .exec()

  catch e
    utils.logAndSetResponse this, 500, "Could not retrieve transactions via the API: #{e}", 'error'

###
# Adds an transaction
###
exports.addTransaction = ->

  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to addTransaction denied.", 'info'
    return

  # Get the values to use
  transactionData = this.request.body
  tx = new transactions.Transaction transactionData

  try
    # Try to add the new transaction (Call the function that emits a promise and Koa will wait for the function to complete)
    yield Q.ninvoke tx, "save"
    this.status = 201
    logger.info "User #{this.authenticated.email} created transaction with id #{tx.id}"

    generateEvents tx
  catch e
    utils.logAndSetResponse this, 500, "Could not add a transaction via the API: #{e}", 'error'


###
# Retrieves the details for a specific transaction
###
exports.getTransactionById = (transactionId) ->
  # Get the values to use
  transactionId = unescape transactionId

  try
    filtersObject = this.request.query
    filterRepresentation = filtersObject.filterRepresentation

    #remove filterRepresentation values from filtersObject (Not apart of filtering and will break filter if present)
    delete filtersObject.filterRepresentation

    # set filterRepresentation to 'full' if not supplied
    if not filterRepresentation then filterRepresentation = 'full'

    # --------------Check if user has permission to view full content----------------- #
    # if user NOT admin, determine their representation privileges.
    if not authorisation.inGroup 'admin', this.authenticated
      # retrieve transaction channelID
      txChannelID = yield transactions.Transaction.findById(transactionId, channelID: 1, _id: 0).exec()
      if txChannelID?.length is 0
        this.body = "Could not find transaction with ID: #{transactionId}"
        this.status = 404
        return
      else
        # assume user is not allowed to view all content - show only 'simpledetails'
        filterRepresentation = 'simpledetails'

        # get channel.txViewFullAcl information by channelID
        channel = yield Channel.findById(txChannelID.channelID, txViewFullAcl: 1, _id: 0).exec()

        # loop through user groups
        for group in this.authenticated.groups
          # if user role found in channel txViewFullAcl - user has access to view all content
          if channel.txViewFullAcl.indexOf(group) >= 0
            # update filterRepresentation object to be 'full' and allow all content
            filterRepresentation = 'full'
            break

    # --------------Check if user has permission to view full content----------------- #
    # get projection object
    projectionFiltersObject = getProjectionObject filterRepresentation

    result = yield transactions.Transaction.findById(transactionId, projectionFiltersObject).exec()

    # Test if the result if valid
    if not result
      this.body = "Could not find transaction with ID: #{transactionId}"
      this.status = 404
    # Test if the user is authorised
    else if not authorisation.inGroup 'admin', this.authenticated
      channels = yield authorisation.getUserViewableChannels this.authenticated
      if getChannelIDsArray(channels).indexOf(result.channelID.toString()) >= 0
        this.body = result
      else
        utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not authenticated to retrieve transaction #{transactionId}", 'info'
    else
      this.body = result

  catch e
    utils.logAndSetResponse this, 500, "Could not get transaction by ID via the API: #{e}", 'error'


###
# Retrieves all transactions specified by clientId
###
exports.findTransactionByClientId = (clientId) ->
  clientId = unescape clientId

  try

    filtersObject = this.request.query
    filterRepresentation = filtersObject.filterRepresentation

    # get projection object
    projectionFiltersObject = getProjectionObject filterRepresentation

    filtersObject = {}
    filtersObject.clientID = clientId

    # Test if the user is authorised
    if not authorisation.inGroup 'admin', this.authenticated
      # if not an admin, restrict by transactions that this user can view
      channels = yield authorisation.getUserViewableChannels this.authenticated

      filtersObject.channelID = $in: getChannelIDsArray channels

      # set 'filterRepresentation' to default if user isnt admin
      filterRepresentation = ''

    # execute the query
    this.body = yield transactions.Transaction
      .find filtersObject, projectionFiltersObject
      .sort 'request.timestamp': -1
      .exec()

  catch e
    utils.logAndSetResponse this, 500, "Could not get transaction by clientID via the API: #{e}", 'error'


generateEvents = (transaction) ->
  Channel.findById transaction.channelID, (err, channel) ->
    events.storeEvents {
      transactionId: transaction._id
      requestTimestamp: transaction.request.timestamp
      response: transaction.response
      authorisedChannel: channel
      routes: transaction.routes
      }, ->

updateTransactionMetrics = (updates, doc) ->
  if updates['$push']?.routes?
    for k, route of updates['$push']
      do (route) ->
        if route.metrics?
          for metric in route.metrics
            if metric.type == 'counter'
              logger.debug "incrementing mediator counter  #{metric.name}"
              sdc.increment "#{domain}.channels.#{doc.channelID}.#{route.name}.mediator_metrics.#{metric.name}"

            if metric.type == 'timer'
              logger.debug "incrementing mediator timer  #{metric.name}"
              sdc.timing "#{domain}.channels.#{doc.channelID}.#{route.name}.mediator_metrics.#{metric.name}", metric.value

            if metric.type == 'gauge'
              logger.debug "incrementing mediator gauge  #{metric.name}"
              sdc.gauge "#{domain}.channels.#{doc.channelID}.#{route.name}.mediator_metrics.#{metric.name}", metric.value

        for orchestration in route.orchestrations
          do (orchestration) ->
            orchestrationDuration = orchestration.response.timestamp - orchestration.request.timestamp
            orchestrationStatus = orchestration.response.status
            orchestrationName = orchestration.name
            if orchestration.group
              orchestrationName = "#{orchestration.group}.#{orchestration.name}" #Namespace it by group

            ###
            # Update timers
            ###
            logger.debug 'updating async route timers'
            sdc.timing "#{domain}.channels.#{doc.channelID}.#{route.name}.orchestrations.#{orchestrationName}", orchestrationDuration
            sdc.timing "#{domain}.channels.#{doc.channelID}.#{route.name}.orchestrations.#{orchestrationName}.statusCodes.#{orchestrationStatus}" , orchestrationDuration

            ###
            # Update counters
            ###
            logger.debug 'updating async route counters'
            sdc.increment "#{domain}.channels.#{doc.channelID}.#{route.name}.orchestrations.#{orchestrationName}"
            sdc.increment "#{domain}.channels.#{doc.channelID}.#{route.name}.orchestrations.#{orchestrationName}.statusCodes.#{orchestrationStatus}"

            if orchestration.metrics?
              for metric in orchestration.metrics
                if metric.type == 'counter'
                  logger.debug "incrementing #{route.name} orchestration counter #{metric.name}"
                  sdc.increment "#{domain}.channels.#{doc.channelID}.#{route.name}.orchestrations.#{orchestrationName}.#{metric.name}", metric.value

                if metric.type == 'timer'
                  logger.debug  "incrementing #{route.name} orchestration timer #{metric.name}"
                  sdc.timing "#{domain}.channels.#{doc.channelID}.#{route.name}.orchestrations.#{orchestrationName}.#{metric.name}", metric.value

                if metric.type == 'gauge'
                  logger.debug  "incrementing #{route.name} orchestration gauge #{metric.name}"
                  sdc.gauge "#{domain}.channels.#{doc.channelID}.#{route.name}.orchestrations.#{orchestrationName}.#{metric.name}", metric.value


###
# Updates a transaction record specified by transactionId
###
exports.updateTransaction = (transactionId) ->

  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to updateTransaction denied.", 'info'
    return

  transactionId = unescape transactionId
  updates = this.request.body

  try
    yield transactions.Transaction.findByIdAndUpdate(transactionId, updates).exec()
    this.body = "Transaction with ID: #{transactionId} successfully updated"
    this.status = 200
    logger.info "User #{this.authenticated.email} updated transaction with id #{transactionId}"

    transactions.Transaction.findById transactionId, (err, doc) ->
      generateEvents doc
      updateTransactionMetrics updates, doc

  catch e
    utils.logAndSetResponse this, 500, "Could not update transaction via the API: #{e}", 'error'


###
#Removes a transaction
###
exports.removeTransaction = (transactionId) ->

  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to removeTransaction denied.", 'info'
    return

  # Get the values to use
  transactionId = unescape transactionId

  try
    yield transactions.Transaction.findByIdAndRemove(transactionId).exec()
    this.body = 'Transaction successfully deleted'
    this.status = 200
    logger.info "User #{this.authenticated.email} removed transaction with id #{transactionId}"
  catch e
    utils.logAndSetResponse this, 500, "Could not remove transaction via the API: #{e}", 'error'
