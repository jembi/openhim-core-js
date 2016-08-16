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
    this.body = yield Visualizer.find().exec()
  catch err
    utils.logAndSetResponse this, 500, "Could not fetch visualizers via the API: #{err}", 'error'



# Endpoint that returns specific visualizer by name
exports.getVisualizer = (name) ->
  
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    return utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getVisualizer denied.", 'info'
  
  name = unescape name
  
  try
    result = yield Visualizer.findOne(name: name).exec()
    if not result
      this.body = "Visualizer with name #{name} could not be found."
      this.status = 404
    else
      this.body = result
  catch err
    utils.logAndSetResponse this, 500, "Could not fetch visualizers via the API: #{err}", 'error'



# Endpoint to add new visualizer
exports.addVisualizer = ->
  
  # Must be admin user
  if not authorisation.inGroup 'admin', this.authenticated
    return utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to addVisualizer denied.", 'info'

  visualizerData = this.request.body
  if !visualizerData
    return utils.logAndSetResponse this, 404, "Cannot Add Visualizer, no request object", 'info'

  try
    visualizer = new Visualizer visualizerData
    result = yield Q.ninvoke visualizer, 'save'

    this.body = 'Visualizer successfully created'
    this.status = 201
    logger.info 'User %s created visualizer with id %s', this.authenticated.email, visualizer.id
  catch err
    utils.logAndSetResponse this, 500, "Could not add visualizer via the API: #{err}", 'error'



# Endpoint to update specific visualizer by name
exports.updateVisualizer = (name) ->
  
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    return utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to updateVisualizer denied.", 'info'

  visualizerData = this.request.body
  if !visualizerData
    return utils.logAndSetResponse this, 404, "Cannot Update Visualizer with name #{name}, no request object", 'info'
  
  name = unescape name
  
  # Ignore _id
  delete visualizerData._id if visualizerData._id
  
  try
    result = yield Visualizer.findOneAndUpdate(name: name, visualizerData).exec()
    if !result
      return utils.logAndSetResponse this, 404, "Cannot Update Visualizer with name #{name}, #{name} does not exist", 'info'
      
    this.body = "Successfully updated visualizer with name #{name}"
    logger.info "User #{this.authenticated.email} updated visualizer #{name}"
  catch e
    utils.logAndSetResponse this, 500, "Could not update visualizer #{name} via the API #{e}", 'error'



# Endpoint to remove specific visualizer by name
exports.removeVisualizer = (name) ->
  
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    return utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to removeVisualizer denied.", 'info'

  name = unescape name

  try
    v = yield Visualizer.findOneAndRemove(name: name).exec()
    if not v
      return utils.logAndSetResponse this, 404, "Could not find visualizer with #{name}", 'info'

    this.body = "Successfully removed visualizer with name #{name}"
    logger.info "User #{this.authenticated.email} removed visualizer #{name}"
  catch e
    utils.logAndSetResponse this, 500, "Could not remove visualizer #{name} via the API #{e}", 'error'
