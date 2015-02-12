Client = require('../model/clients').Client
Q = require 'q'
logger = require 'winston'
authorisation = require './authorisation'

###
# Adds a client
###
exports.addClient = () ->

  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    logger.info "User #{this.authenticated.email} is not an admin, API access to addClient denied."
    this.body = "User #{this.authenticated.email} is not an admin, API access to addClient denied."
    this.status = 'forbidden'
    return

  clientData = this.request.body

  try
    client = new Client clientData
    result = yield Q.ninvoke client, 'save'
    
    this.body = 'Client successfully created'
    this.status = 'created'
    logger.info "User #{this.authenticated.email} created client with id #{client.id}"
  catch e
    logger.error "Could not add a client via the API: #{e.message}"
    this.body = e.message
    this.status = 'bad request'

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
      logger.info "The property (#{property}) you are trying to retrieve is not found."
      this.body = "The property (#{property}) you are trying to retrieve is not found."
      this.status = 'not found'
      return
  else
    # Test if the user is authorised
    if not authorisation.inGroup 'admin', this.authenticated
      logger.info "User #{this.authenticated.email} is not an admin, API access to findClientById denied."
      this.body = "User #{this.authenticated.email} is not an admin, API access to findClientById denied."
      this.status = 'forbidden'
      return

  clientId = unescape clientId

  try
    result = yield Client.findById(clientId, projectionRestriction).exec()
    if result is null
      this.body = "Client with id #{clientId} could not be found."
      this.status = 'not found'
    else
      this.body = result
  catch e
    logger.error "Could not find client by id #{clientId} via the API: #{e.message}"
    this.body = e.message
    this.status = 'internal server error'


exports.findClientByDomain = (clientDomain) ->

  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    logger.info "User #{this.authenticated.email} is not an admin, API access to findClientByDomain denied."
    this.body = "User #{this.authenticated.email} is not an admin, API access to findClientByDomain denied."
    this.status = 'forbidden'
    return

  clientDomain = unescape clientDomain

  try
    result = yield Client.findOne(clientDomain: clientDomain).exec()
    if result is null
      this.body = "Could not find client with clientDomain #{clientDomain}"
      this.status = 'not found'
    else
      this.body = result
  catch e
    logger.error "Could not find client by client Domain #{clientDomain} via the API: #{e.message}"
    this.body = e.message
    this.status = 'internal server error'

exports.updateClient = (clientId) ->

  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    logger.info 'User ' +this.authenticated.email+ ' is not an admin, API access to updateClient denied.'
    this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to updateClient denied.'
    this.status = 'forbidden'
    return

  clientId = unescape clientId
  clientData = this.request.body

  # Ignore _id if it exists, a user shouldn't be able to update the internal id
  delete clientData._id if clientData._id

  try
    yield Client.findByIdAndUpdate(clientId, clientData).exec()
    this.body = 'Successfully updated client.'
    logger.info "User #{this.authenticated.email} updated client with id #{clientId}"
  catch e
    logger.error "Could not update client by ID #{clientId} via the API: #{e.message}"
    this.body = e.message
    this.status = 'internal server error'

exports.removeClient = (clientId) ->
 
  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    logger.info "User #{this.authenticated.email} is not an admin, API access to removeClient denied."
    this.body = "User #{this.authenticated.email} is not an admin, API access to removeClient denied."
    this.status = 'forbidden'
    return

  clientId = unescape clientId

  try
    yield Client.findByIdAndRemove(clientId).exec()
    this.body = "Successfully removed client with ID #{clientId}"
    logger.info "User #{this.authenticated.email} removed client with id #{clientId}"
  catch e
    logger.error "Could not remove client by ID #{clientId} via the API: #{e.message}"
    this.body = e.message
    this.status = 'internal server error'

exports.getClients = () ->

  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    logger.info "User #{this.authenticated.email} is not an admin, API access to getClients denied."
    this.body = "User #{this.authenticated.email} is not an admin, API access to getClients denied."
    this.status = 'forbidden'
    return

  try
    this.body = yield Client.find().exec()
  catch e
    logger.error "Could not fetch all clients via the API: #{e.message}"
    this.message = e.message
    this.status = 'internal server error'
