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


# API endpoint that returns metadata for export
exports.getMetadata = () ->
  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getUsers denied.", 'info'
    return

  try
    exportObject = {}
    params = this.request.query
    
    # Return selected documents from selected collections for export
    if params.selected == 'true'
      for key of params
        if collections[key]
          ids = params[key]
          ids = [ids] if typeof ids is 'string'
          exportObject[key] = yield collections[key].find({ _id: { $in: ids } }).exec()
      return this.body = [exportObject]
    
    # Return all documents from all collections for export
    for key of collections
      exportObject[key] = yield collections[key].find().exec()
    this.body = [exportObject]
    this.status = 200
  catch e
    utils.logAndSetResponse this, 500, "Could not fetch specified metadata via the API #{e}", 'error'
    this.body = e.message
    this.status = 400


# API endpoint that inserts metadata from import
exports.insertMetadata = () ->
  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getUsers denied.", 'info'
    return
  
  try
    returnObject = {"errors":[], "successes":[]}
    insertObject = this.request.body
    
    for key of insertObject
      return throw new Error "Invalid Import Object" if key not of collections
      insertDocuments = insertObject[key]
      for doc in insertDocuments
        try
          name = doc.name
          if key == 'Users'
            name = doc.firstname + ' ' + doc.surname
            delete doc.tokenType if doc.tokenType == null
          doc = new collections[key] doc
          result = yield Q.ninvoke doc, 'save'
          logger.info "User #{this.authenticated.email} successfully inserted #{key}"
          returnObject.successes.push {
            model: key
            record: doc
            status: "Successful"
            message: "Successfully inserted #{key} with name #{name}"
          }
        catch e
          logger.error "Failed to insert #{key} with name #{name}. #{e.message}"
          returnObject.errors.push {
            model: key
            record: doc
            status: "Error"
            message: e.message
          }
        
    this.body = returnObject
    this.status = 201
  catch e
    utils.logAndSetResponse this, 500, "Could not fetch all users via the API #{e}", 'error'
    this.body = e.message
    this.status = 400


# API endpoint that updates metadata from import
exports.updateMetadata = () ->
  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getUsers denied.", 'info'
    return
  
  try
    returnObject = {"errors":[], "successes":[]}
    updateObject = this.request.body
    
    for key of updateObject
      return throw new Error "Invalid Import Object" if key not of collections
      updateDocuments = updateObject[key]
      for doc in updateDocuments
        name = doc.name
        if key == 'Users'
          name = doc.firstname + ' ' + doc.surname
          delete doc.tokenType if doc.tokenType == null
        docId = doc._id
        delete doc._id if doc._id
        try
          yield collections[key].findByIdAndUpdate(docId, doc).exec()
          logger.info "User #{this.authenticated.email} updated #{key} with id #{docId}"
          returnObject.successes.push {
            model: key
            record: doc
            status: "Successful"
            message: "Successfully updated #{key} with name #{name}"
          }
        catch e
          logger.error "Failed to update #{key} with name #{name}. #{e.message}"
          returnObject.errors.push {
            model: key
            record: doc
            status: "Error"
            message: e.message
          }
        
    this.body = returnObject
    this.status = 201
  catch e
    utils.logAndSetResponse this, 500, "Could not fetch all users via the API #{e}", 'error'
    this.body = e.message
    this.status = 400
