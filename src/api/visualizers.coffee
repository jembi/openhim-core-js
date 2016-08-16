Visualizer = require('../model/visualizer').Visualizer
authorisation = require './authorisation'
Q = require 'q'
utils = require '../utils'
logger = require 'winston'

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

exports.addNewVisualizer = ->
  # Must be admin user
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getAllVisualizers denied.", 'info'
    return

  # Get the values to use
  visualizerData = this.request.body
  logger.info visualizerData

  try
    visualizer = new Visualizer visualizerData

    # Generator Function
    result = yield Q.ninvoke visualizer, 'save' # [WIP] !!!!

    # All ok! So set the result
    this.body = 'Visualizer successfully created'
    this.status = 201
    logger.info 'User %s created visualizer with id %s', this.authenticated.email, visualizer.id
  catch err
    # Error! So inform the user
    utils.logAndSetResponse this, 400, "Could not add visualizer via the API: #{err}", 'error'
  
