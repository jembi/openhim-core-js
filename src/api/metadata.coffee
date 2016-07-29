Channel = require('../model/channels').Channel
Client = require('../model/clients').Client
Mediator = require('../model/mediators').Mediator
User = require('../model/users').User
ContactGroup = require('../model/contactGroups').ContactGroup

Q = require 'q'
logger = require 'winston'
authorisation = require './authorisation'
utils = require "../utils"

# Map string parameters to collections
collections =
  Channels: Channel
  Clients: Client
  Mediators: Mediator
  Users: User
  ContactGroups: ContactGroup


#Function to remove properties from export object
removeProperties = (obj) ->
  propertyID = '_id'
  propertyV = '__v'
  
  for prop of obj
    if (prop == propertyID || prop == propertyV)
      delete obj[prop]
    else if ( typeof obj[prop] == 'object' || obj[prop] instanceof Array )
      removeProperties(obj[prop])
  return obj


# Function to return unique identifier key and value for a collection
getUniqueIdentifierForCollection = (collection, doc) ->
  switch collection
    when 'Channels' then uidKey = 'name'; uid = doc.name
    when 'Clients' then uidKey = 'clientID'; uid = doc.clientID
    when 'Mediators' then uidKey = 'urn'; uid = doc.urn
    when 'Users' then uidKey = 'email'; uid = doc.email
    when 'ContactGroups' then uidKey = 'groups'; uid = doc.groups
  returnObj = {}
  returnObj[uidKey] = uid
  return returnObj


# Build response object
buildResponseObject = (model, doc, status, message, uid) ->
  return {
    model: model
    record: doc
    status: status
    message: message
    uid: uid
  }

# API endpoint that returns metadata for export
exports.getMetadata = () ->
  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getUsers denied.", 'info'
    return

  try
    exportObject = {}
    params = this.request.query
    
    # Return all documents from all collections for export
    for col of collections
      exportObject[col] = yield collections[col].find().lean().exec()
      for doc of exportObject[col]
        if exportObject[col][doc]._id
          exportObject[col][doc] = removeProperties exportObject[col][doc]

    this.body = [exportObject]
    this.status = 200
  catch e
    this.body = e.message
    utils.logAndSetResponse this, 500, "Could not fetch specified metadata via the API #{e}", 'error'

# API endpoint that checks for conflicts between import object and database
exports.validateMetadata = () ->
  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getUsers denied.", 'info'
    return
  
  try
    returnObject = {"errors":[], "successes":[]}
    insertObject = this.request.body
    
    for key of insertObject
      return utils.logAndSetResponse this, 400, "Could not fetch all users via the API: 'Invalid Request Body'", 'error' if key not of collections
      insertDocuments = insertObject[key]
      for doc in insertDocuments
        try
          uidObj = getUniqueIdentifierForCollection key, doc
          uid = uidObj[Object.keys(uidObj)[0]]

          
          result = yield collections[key].find(uidObj).exec()
          if result and result.length > 0 and result[0]._id
            status = 'Conflict'
          else
            doc = new collections[key] doc
            error = doc.validateSync()
            return throw new Error "Validation failed: #{error}" if error
            status = 'Valid'
          
          logger.info "User #{this.authenticated.email} successfully inserted #{key} with unique identifier #{uid}"
          returnObject.successes.push buildResponseObject key, doc, status, 'Ok', uid
          
        catch e
          logger.error "Failed to insert #{key} with unique identifier #{uid}. #{e.message}"
          returnObject.errors.push buildResponseObject key, doc, 'Invalid', e.message, uid
        
    this.body = returnObject
    this.status = 201
  catch e
    this.body = e.message
    utils.logAndSetResponse this, 500, "Could not fetch all users via the API #{e}", 'error'


# API endpoint that updates or inserts metadata from import
exports.upsertMetadata = () ->
  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getUsers denied.", 'info'
    return
  
  try
    returnObject = {"errors":[], "successes":[]}
    insertObject = this.request.body
    
    for key of insertObject
      return utils.logAndSetResponse this, 400, "Could not fetch all users via the API: 'Invalid Request Body'", 'error' if key not of collections
      insertDocuments = insertObject[key]
      for doc in insertDocuments
        try
          uidObj = getUniqueIdentifierForCollection key, doc
          uid = uidObj[Object.keys(uidObj)[0]]
          result = yield collections[key].find(uidObj).exec()
          if result and result.length > 0 and result[0]._id
            delete doc._id if doc._id
            yield collections[key].findByIdAndUpdate(result[0]._id, doc).exec()
            status = 'Successfully Updated'
          else
            doc = new collections[key] doc
            result = yield Q.ninvoke doc, 'save'
            status = 'Successfully Inserted'
          
          logger.info "User #{this.authenticated.email} successfully inserted #{key} with unique identifier #{uid}"
          returnObject.successes.push buildResponseObject key, doc, status, 'Ok', uid
          
        catch e
          logger.error "Failed to insert #{key} with unique identifier #{uid}. #{e.message}"
          returnObject.errors.push buildResponseObject key, doc, 'Error', e.message, uid
        
    this.body = returnObject
    this.status = 201
  catch e
    this.body = e.message
    utils.logAndSetResponse this, 500, "Could not fetch all users via the API #{e}", 'error'
