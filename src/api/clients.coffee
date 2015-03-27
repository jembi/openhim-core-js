Client = require('../model/clients').Client
Q = require 'q'
logger = require 'winston'
authorisation = require './authorisation'
utils = require '../utils'

###
# Adds a client
###
exports.addClient = () ->

  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to addClient denied.", 'info'
    return

  clientData = this.request.body

  try
    client = new Client clientData
    result = yield Q.ninvoke client, 'save'
    
    logger.info "User #{this.authenticated.email} created client with id #{client.id}"
    this.body = 'Client successfully created'
    this.status = 201
  catch e
    logger.error "Could not add a client via the API: #{e.message}"
    this.body = e.message
    this.status = 400

###
# Retrieves the details of a specific client
###
exports.getClient = (clientId, property) ->
  projectionRestriction = null

  # if property - Setup client projection and bypass authorization
  if typeof property is 'string'
    if property is 'clientName'
      projectionRestriction =
        _id: 0
        name: 1
    else
      utils.logAndSetResponse this, 404, "The property (#{property}) you are trying to retrieve is not found.", 'info'
      return
  else
    # Test if the user is authorised
    if not authorisation.inGroup 'admin', this.authenticated
      utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to findClientById denied.", 'info'
      return

  clientId = unescape clientId

  try
    result = yield Client.findById(clientId, projectionRestriction).exec()
    if result is null
      utils.logAndSetResponse this, 404, "Client with id #{clientId} could not be found.", 'info'
    else
      this.body = result
  catch e
    logger.error "Could not find client by id #{clientId} via the API: #{e.message}"
    this.body = e.message
    this.status = 500


exports.findClientByDomain = (clientDomain) ->

  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to findClientByDomain denied.", 'info'
    return

  clientDomain = unescape clientDomain

  try
    result = yield Client.findOne(clientDomain: clientDomain).exec()
    if result is null
      utils.logAndSetResponse this, 404, "Could not find client with clientDomain #{clientDomain}", 'info'
    else
      this.body = result
  catch e
    logger.error "Could not find client by client Domain #{clientDomain} via the API: #{e.message}"
    this.body = e.message
    this.status = 500

exports.updateClient = (clientId) ->

  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to updateClient denied.", 'info'
    return

  clientId = unescape clientId
  clientData = this.request.body

  # Ignore _id if it exists, a user shouldn't be able to update the internal id
  delete clientData._id if clientData._id

  try
    yield Client.findByIdAndUpdate(clientId, clientData).exec()
    logger.info "User #{this.authenticated.email} updated client with id #{clientId}"
    this.body = 'Successfully updated client.'
  catch e
    logger.error "Could not update client by ID #{clientId} via the API: #{e.message}"
    this.body = e.message
    this.status = 500

exports.removeClient = (clientId) ->
 
  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to removeClient denied.", 'info'
    return

  clientId = unescape clientId

  try
    yield Client.findByIdAndRemove(clientId).exec()
    this.body = "Successfully removed client with ID #{clientId}"
    logger.info "User #{this.authenticated.email} removed client with id #{clientId}"
  catch e
    logger.error "Could not remove client by ID #{clientId} via the API: #{e.message}"
    this.body = e.message
    this.status = 500

exports.getClients = () ->

  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getClients denied.", 'info'
    return

  try
    this.body = yield Client.find().exec()
  catch e
    logger.error "Could not fetch all clients via the API: #{e.message}"
    this.message = e.message
    this.status = 500
