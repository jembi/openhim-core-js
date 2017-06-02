Visualizer = require('../model/visualizer').Visualizer
authorisation = require './authorisation'
Q = require 'q'
utils = require '../utils'
logger = require 'winston'


# Endpoint that returns all visualizers
exports.getVisualizers = ->
  
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    return utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getVisualizers denied.", 'info'

  try
    this.body = {} #TODO:Fix yield Visualizer.find().exec()
  catch err
    utils.logAndSetResponse this, 500, "Could not fetch visualizers via the API: #{err}", 'error'



# Endpoint that returns specific visualizer by visualizerId
exports.getVisualizer = (visualizerId) ->
  
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    return utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getVisualizer denied.", 'info'
  
  visualizerId = unescape visualizerId
  
  try
    result = {} #TODO:Fix yield Visualizer.findById(visualizerId).exec()
    if not result
      this.body = "Visualizer with _id #{visualizerId} could not be found."
      this.status = 404
    else
      this.body = result
  catch err
    utils.logAndSetResponse this, 500, "Could not fetch visualizer via the API: #{err}", 'error'



# Endpoint to add new visualizer
exports.addVisualizer = ->
  
  # Must be admin user
  if not authorisation.inGroup 'admin', this.authenticated
    return utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to addVisualizer denied.", 'info'

  visualizerData = this.request.body
  if not visualizerData
    return utils.logAndSetResponse this, 404, "Cannot Add Visualizer, no request object", 'info'

  try
    visualizer = new Visualizer visualizerData
    result = {} #TODO:Fix yield Q.ninvoke visualizer, 'save'

    this.body = 'Visualizer successfully created'
    this.status = 201
    logger.info 'User %s created visualizer with id %s', this.authenticated.email, visualizer.id
  catch err
    utils.logAndSetResponse this, 500, "Could not add visualizer via the API: #{err}", 'error'



# Endpoint to update specific visualizer by visualizerId
exports.updateVisualizer = (visualizerId) ->
  
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    return utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to updateVisualizer denied.", 'info'

  visualizerData = this.request.body
  if not visualizerData
    return utils.logAndSetResponse this, 404, "Cannot Update Visualizer with _id #{visualizerId}, no request object", 'info'
  
  visualizerId = unescape visualizerId
  
  # Ignore _id if it exists, a user shouldn't be able to update the internal id
  delete visualizerData._id if visualizerData._id
  
  try
    result = {} #TODO:Fix yield Visualizer.findByIdAndUpdate(visualizerId, visualizerData).exec()
    if not result
      return utils.logAndSetResponse this, 404, "Cannot Update Visualizer with _id #{visualizerId}, does not exist", 'info'
      
    this.body = "Successfully updated visualizer with _id #{visualizerId}"
    logger.info "User #{this.authenticated.email} updated visualizer with _id #{visualizerId}"
  catch e
    utils.logAndSetResponse this, 500, "Could not update visualizer with _id #{visualizerId} via the API #{e}", 'error'



# Endpoint to remove specific visualizer by visualizerId
exports.removeVisualizer = (visualizerId) ->
  
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    return utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to removeVisualizer denied.", 'info'

  visualizerId = unescape visualizerId

  try
    v = {} #TODO:Fix yield Visualizer.findByIdAndRemove(visualizerId).exec()
    if not v
      return utils.logAndSetResponse this, 404, "Could not find visualizer with _id #{visualizerId}", 'info'

    this.body = "Successfully removed visualizer with _id #{visualizerId}"
    logger.info "User #{this.authenticated.email} removed visualizer with _id #{visualizerId}"
  catch e
    utils.logAndSetResponse this, 500, "Could not remove visualizer with _id #{visualizerId} via the API #{e}", 'error'
