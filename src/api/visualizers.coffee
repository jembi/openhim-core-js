logger = require 'winston'
Visualizer = require('../model/visualizer').Visualizer
authorisation = require './authorisation'
utils = require '../utils'

exports.getAllVisualizers = ->
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getAllVisualizers denied.", 'info'
    return

  try
    v = yield Visualizer.find().exec()
    this.body = v
  catch err
    utils.logAndSetResponse this, 500, "Could not fetch visualizers via the API: #{err}", 'error'

exports.removeVisualizer = (name) ->
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to removeVisualizer denied.", 'info'
    return

  name = unescape name

  try
    v = yield Visualizer.findOneAndRemove(name: name).exec()
    if not v
      return utils.logAndSetResponse this, 404, "Could not find visualizer with #{name}", 'info'

    this.body = "Successfully removed visualizer with name #{name}"
    logger.info "User #{this.authenticated.name} removed visualizer #{name}"
  catch e
    utils.logAndSetResponse this, 500, "Could not remove visualizer #{name} via the API #{e}", 'error'
