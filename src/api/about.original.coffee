currentCoreVersion = require('../../package.json').version

logger = require 'winston'
utils = require '../utils'

exports.getAboutInformation = () ->
  
  try
    this.body = {} #TODO:Fix yield { currentCoreVersion: currentCoreVersion, serverTimezone: utils.serverTimezone() }
    this.status = 200
    logger.info "User #{this.authenticated.email} successfully fetched 'about' information"
  catch e
    this.body = e.message
    utils.logAndSetResponse this, 500, "Could not fetch 'about' info via the API #{e}", 'error'