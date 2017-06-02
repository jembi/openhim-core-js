Channel = require('../model/channels').Channel
Client = require('../model/clients').Client
Mediator = require('../model/mediators').Mediator
User = require('../model/users').User
ContactGroup = require('../model/contactGroups').ContactGroup
Keystore = require('../model/keystore').Keystore

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
  Keystore: Keystore


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
    return utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getMetadata denied.", 'info'

  try
    exportObject = {}
    params = this.request.query
    
    # Return all documents from all collections for export
    for col of collections
      exportObject[col] = {} #TODO:Fix yield collections[col].find().lean().exec()
      for doc in exportObject[col]
        if doc._id
          doc = removeProperties doc

    this.body = [exportObject]
    this.status = 200
  catch e
    this.body = e.message
    utils.logAndSetResponse this, 500, "Could not fetch specified metadata via the API #{e}", 'error'


handleMetadataPost = (action, that) ->
  # Test if the user is authorised
  if not authorisation.inGroup 'admin', that.authenticated
    return utils.logAndSetResponse that, 403, "User #{that.authenticated.email} is not an admin, API access to importMetadata denied.", 'info'

  try
    returnObject = []
    insertObject = that.request.body
    
    for key of insertObject
      insertDocuments = insertObject[key]
      for doc in insertDocuments
        try
          if key not of collections
            throw new Error "Invalid Collection in Import Object"
          
          # Keystore model does not have a uid other than _id and may not contain more than one entry
          if key is 'Keystore'
            result = {} #TODO:Fix yield collections[key].find().exec()
            uid = ''
          else
            uidObj = getUniqueIdentifierForCollection key, doc
            uid = uidObj[Object.keys(uidObj)[0]]
            result = {} #TODO:Fix yield collections[key].find(uidObj).exec()
          
          if action is 'import'
            if result and result.length > 0 and result[0]._id
              delete doc._id if doc._id
              {} #TODO:Fix yield collections[key].findByIdAndUpdate(result[0]._id, doc).exec()
              status = 'Updated'
            else
              doc = new collections[key] doc
              result = {} #TODO:Fix yield Q.ninvoke doc, 'save'
              status = 'Inserted'
          
          if action is 'validate'
            if result and result.length > 0 and result[0]._id
              status = 'Conflict'
            else
              doc = new collections[key] doc
              error = doc.validateSync()
              if error
                throw new Error "Document Validation failed: #{error}"
              status = 'Valid'
          
          logger.info "User #{that.authenticated.email} performed #{action} action on #{key}, got #{status}"
          returnObject.push buildResponseObject key, doc, status, '', uid
          
        catch e
          logger.error "Failed to #{action} #{key} with unique identifier #{uid}. #{e.message}"
          returnObject.push buildResponseObject key, doc, 'Error', e.message, uid
        
    that.body = returnObject
    that.status = 201
  catch e
    that.body = e.message
    utils.logAndSetResponse that, 500, "Could not import metadata via the API #{e}", 'error'


# API endpoint that upserts metadata
exports.importMetadata = () ->
  handleMetadataPost 'import', this
  
# API endpoint that checks for conflicts between import object and database
exports.validateMetadata = () ->
  handleMetadataPost 'validate', this

if process.env.NODE_ENV == "test"
  exports.buildResponseObject = buildResponseObject
  exports.getUniqueIdentifierForCollection = getUniqueIdentifierForCollection
  exports.removeProperties = removeProperties
