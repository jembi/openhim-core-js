audit = require '../model/audit'
authorisation = require './authorisation'
logger = require 'winston'
utils = require "../utils"


# function to construct projection object
getProjectionObject = ->
  # currenlty show all data - no projections
  return {}
  



###
# Retrieves the list of Audit Records
###
exports.getAudits = ->
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 'forbidden', "User #{this.authenticated.email} is not an admin, API access to getAuditRecords denied.", 'info'
    return

  try
    filtersObject = this.request.query
    # construct date range filter option
    if filtersObject.startDate and filtersObject.endDate
      filtersObject['timestamp'] = $gte: filtersObject.startDate, $lt: filtersObject.endDate

      # remove startDate/endDate from objects filter (Not part of filtering and will break filter)
      delete filtersObject.startDate
      delete filtersObject.endDate

    # get limit and page values
    filterLimit = filtersObject.filterLimit
    filterPage = filtersObject.filterPage

    # remove limit/page values from filtersObject (Not apart of filtering and will break filter if present)
    delete filtersObject.filterLimit
    delete filtersObject.filterPage

    # determine skip amount
    filterSkip = filterPage*filterLimit

    # get projection object
    projectionFiltersObject = getProjectionObject

    # execute the query
    this.body = yield audit.AuditRecord
      .find filtersObject, projectionFiltersObject
      .skip filterSkip
      .limit filterLimit
      .sort 'timestamp': -1
      .exec()

  catch e
    utils.logAndSetResponse this, 'internal server error', "Could not retrieve audits via the API: #{e}", 'error'





###
# Retrieves the details for a specific Audit Record
###
exports.getAuditById = (auditRecordId) ->
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 'forbidden', "User #{this.authenticated.email} is not an admin, API access to getAuditRecordById denied.", 'info'
    return

  # Get the values to use
  auditRecordId = unescape auditRecordId

  try
    filtersObject = this.request.query

    # get projection object
    projectionFiltersObject = getProjectionObject

    result = yield audit.AuditRecord.findById(auditRecordId, projectionFiltersObject).exec()

    # Test if the result if valid
    if result?.length is 0
      this.body = "Could not find audit record with ID: #{auditRecordId}"
      this.status = 'not found'
    else
      this.body = result

  catch e
    utils.logAndSetResponse this, 'internal server error', "Could not get audit record by ID via the API: #{e}", 'error'
