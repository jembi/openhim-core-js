currentCoreVersion = require('../../package.json').version
aboutInfoObject = require '../../config/about.json'

logger = require 'winston'
utils = require '../utils'
authorisation = require './authorisation'

exports.getAboutInformation = () ->
  
  if not authorisation.inGroup 'admin', this.authenticated
    return utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to addClient denied.", 'info'
  
  try
    aboutInfoObject.currentCoreVersion = currentCoreVersion

    logger.info "User #{this.authenticated.email} successfully fetched 'about' information"
    this.body = yield aboutInfoObject
    this.status = 200
  catch e
    this.body = e.message
    utils.logAndSetResponse this, 500, "Could not fetch 'about' info via the API #{e}", 'error'