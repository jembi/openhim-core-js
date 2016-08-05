currentCoreVersion = require('../../package.json').version
versionsObject = require '../../config/versions.json'

logger = require 'winston'

exports.getAboutInformation = () ->  
  try
    versionsObject.currentCoreVersion = currentCoreVersion
    result = yield versionsObject
    this.body = versionsObject
    this.status = 200
    logger.info "Successfully sent version info"
  catch e
    this.body = e.message
    utils.logAndSetResponse this, 500, "Could not fetch version info via the API #{e}", 'error'