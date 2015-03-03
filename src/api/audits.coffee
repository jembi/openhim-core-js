Audit = require('../model/audits').Audit
authorisation = require './authorisation'
Q = require 'q'
logger = require 'winston'
utils = require "../utils"


# function to construct projection object
getProjectionObject = (filterRepresentation) ->
  switch filterRepresentation
    when "simpledetails"
      # view minimum required data for audit details view
      return {}
    when "full"
      # view all audit data
      return {}
    else
      # no filterRepresentation supplied - simple view
      # view minimum required data for audits
      return { "ParticipantObjectIdentification": 0, "ActiveParticipant": 0, "rawMessage": 0 }
  


###
# Adds a Audit
###
exports.addAudit = ->
  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 'forbidden', "User #{this.authenticated.email} is not an admin, API access to addAudit denied.", 'info'
    return

  auditData = this.request.body

  try
    audit = new Audit auditData
    result = yield Q.ninvoke audit, 'save'
    
    logger.info "User #{this.authenticated.email} created audit with id #{audit.id}"
    this.body = 'Audit successfully created'
    this.status = 'created'
  catch e
    logger.error "Could not add a audit via the API: #{e.message}"
    this.body = e.message
    this.status = 'bad request'




###
# Retrieves the list of Audits
###
exports.getAudits = ->
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 'forbidden', "User #{this.authenticated.email} is not an admin, API access to getAudits denied.", 'info'
    return

  try

    filtersObject = this.request.query

    #construct date range filter option
    if filtersObject.startDate and filtersObject.endDate
      filtersObject['EventIdentification.EventDateTime'] = $gte: filtersObject.startDate, $lt: filtersObject.endDate

      #remove startDate/endDate from objects filter (Not part of filtering and will break filter)
      delete filtersObject.startDate
      delete filtersObject.endDate

    #get limit and page values
    filterLimit = filtersObject.filterLimit
    filterPage = filtersObject.filterPage
    filterRepresentation = filtersObject.filterRepresentation

    #remove limit/page/filterRepresentation values from filtersObject (Not apart of filtering and will break filter if present)
    delete filtersObject.filterLimit
    delete filtersObject.filterPage
    delete filtersObject.filterRepresentation

    #determine skip amount
    filterSkip = filterPage*filterLimit

    # get projection object
    projectionFiltersObject = getProjectionObject filterRepresentation

    # execute the query
    this.body = yield Audit
      .find filtersObject, projectionFiltersObject
      .skip filterSkip
      .limit filterLimit
      .sort 'EventIdentification.EventDateTime': -1
      .exec()
  catch e
    utils.logAndSetResponse this, 'internal server error', "Could not retrieve audits via the API: #{e}", 'error'





###
# Retrieves the details for a specific Audit Record
###
exports.getAuditById = (auditId) ->
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 'forbidden', "User #{this.authenticated.email} is not an admin, API access to getAuditById denied.", 'info'
    return

  # Get the values to use
  auditId = unescape auditId

  try
    filtersObject = this.request.query

    # get projection object
    projectionFiltersObject = getProjectionObject

    result = yield Audit.findById(auditId, projectionFiltersObject).exec()

    # Test if the result if valid
    if result?.length is 0
      this.body = "Could not find audits record with ID: #{auditId}"
      this.status = 'not found'
    else
      this.body = result

  catch e
    utils.logAndSetResponse this, 'internal server error', "Could not get audit by ID via the API: #{e}", 'error'
