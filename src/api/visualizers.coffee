Visualizer = require('../model/visualizer').Visualizer
authorisation = require './authorisation'
utils = require '../utils'

exports.getAllVisualizers = ->
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, 'User #{this.authenticated.email} is not an admin, API access to getAllVisualizers denied.', 'info'
    return

  try
    v = yield Visualizer.find().exec()
    this.body = v
  catch err
    utils.logAndSetResponse this, 500, 'Could not fetch visualizers via the API: #{err}', 'error'
