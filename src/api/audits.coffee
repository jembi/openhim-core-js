Audit = require('../model/audits').Audit
authorisation = require './authorisation'
Q = require 'q'
logger = require 'winston'
utils = require "../utils"
atna = require 'atna-audit'
auditing = require '../auditing'
os = require 'os'
config = require "../config/config"
config.router = config.get('router')
config.api = config.get('api')
himSourceID = config.get('auditing').auditEvents.auditSourceID


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
      return { "participantObjectIdentification": 0, "activeParticipant": 0, "rawMessage": 0 }
 

# Audit the audit record retrieval
auditLogUsed = (auditId, outcome, user) ->
  groups = user.groups.join(',')
  uri = "https://#{config.router.externalHostname}:#{config.api.httpsPort}/audits/#{auditId}"
  audit = atna.auditLogUsedAudit outcome, himSourceID, os.hostname(), user.email, groups, groups, uri
  audit = atna.wrapInSyslog audit
  auditing.sendAuditEvent audit, ->
    logger.debug "Processed audit log used message for user '#{user.email}' and audit '#{auditId}'"


###
# Adds a Audit
###
exports.addAudit = ->
  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to addAudit denied.", 'info'
    return

  auditData = this.request.body

  try
    audit = new Audit auditData
    result = yield Q.ninvoke audit, 'save'
    
    logger.info "User #{this.authenticated.email} created audit with id #{audit.id}"
    this.body = 'Audit successfully created'
    this.status = 201
  catch e
    logger.error "Could not add a audit via the API: #{e.message}"
    this.body = e.message
    this.status = 400




###
# Retrieves the list of Audits
###
exports.getAudits = ->
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getAudits denied.", 'info'
    return

  try

    filtersObject = this.request.query

    #get limit and page values
    filterLimit = filtersObject.filterLimit ? 0
    filterPage = filtersObject.filterPage ? 0
    filterRepresentation = filtersObject.filterRepresentation

    #remove limit/page/filterRepresentation values from filtersObject (Not apart of filtering and will break filter if present)
    delete filtersObject.filterLimit
    delete filtersObject.filterPage
    delete filtersObject.filterRepresentation

    #determine skip amount
    filterSkip = filterPage*filterLimit

    # get projection object
    projectionFiltersObject = getProjectionObject filterRepresentation

    if filtersObject.filters?
      filters = JSON.parse filtersObject.filters
    else
      filters = {}

    # parse date to get it into the correct format for querying
    if filters['eventIdentification.eventDateTime']
      filters['eventIdentification.eventDateTime'] = JSON.parse filters['eventIdentification.eventDateTime']

    if filters['participantObjectIdentification.participantObjectID']
      # filter by AND on same property for patientID and objectID
      if filters['participantObjectIdentification.participantObjectID'].type
        patientID = new RegExp filters['participantObjectIdentification.participantObjectID'].patientID
        objectID = new RegExp filters['participantObjectIdentification.participantObjectID'].objectID
        filters['$and'] = [ { 'participantObjectIdentification.participantObjectID': patientID }, { 'participantObjectIdentification.participantObjectID': objectID } ]
        # remove participantObjectIdentification.participantObjectID property as we create a new '$and' operator
        delete filters['participantObjectIdentification.participantObjectID']
      else
        participantObjectID = JSON.parse filters['participantObjectIdentification.participantObjectID']
        filters['participantObjectIdentification.participantObjectID'] = new RegExp "#{participantObjectID}"

    # execute the query
    this.body = yield Audit
      .find filters, projectionFiltersObject
      .skip filterSkip
      .limit filterLimit
      .sort 'eventIdentification.eventDateTime': -1
      .exec()

    # audit each retrieved record, but only for non-basic representation requests
    if filterRepresentation is 'full' or filterRepresentation is 'simpledetails'
      for record in this.body
        auditLogUsed record._id, atna.OUTCOME_SUCCESS, this.authenticated

  catch e
    utils.logAndSetResponse this, 500, "Could not retrieve audits via the API: #{e}", 'error'


###
# Retrieves the details for a specific Audit Record
###
exports.getAuditById = (auditId) ->
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getAuditById denied.", 'info'
    return

  # Get the values to use
  auditId = unescape auditId

  try
    # get projection object
    projectionFiltersObject = getProjectionObject 'full'

    result = yield Audit.findById(auditId, projectionFiltersObject).exec()

    # Test if the result if valid
    if not result
      this.body = "Could not find audits record with ID: #{auditId}"
      this.status = 404
      auditLogUsed auditId, atna.OUTCOME_MINOR_FAILURE, this.authenticated
    else
      this.body = result
      auditLogUsed auditId, atna.OUTCOME_SUCCESS, this.authenticated

  catch e
    utils.logAndSetResponse this, 500, "Could not get audit by ID via the API: #{e}", 'error'
    auditLogUsed auditId, atna.OUTCOME_MAJOR_FAILURE, this.authenticated



###
# construct audit filtering dropdown options
###
exports.getAuditsFilterOptions = ->

  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getAudits denied.", 'info'
    return

  try

    # execute the query
    eventID = yield Audit.distinct('eventIdentification.eventID').exec()
    eventTypeCode = yield Audit.distinct('eventIdentification.eventTypeCode').exec()
    roleIDCode = yield Audit.distinct('activeParticipant.roleIDCode').exec()
    participantObjectIDTypeCode = yield Audit.distinct('participantObjectIdentification.participantObjectIDTypeCode').exec()
    auditSourceID = yield Audit.distinct('auditSourceIdentification.auditSourceID').exec()

    responseObject =
      eventType: eventTypeCode
      eventID: eventID
      activeParticipantRoleID: roleIDCode
      participantObjectIDTypeCode: participantObjectIDTypeCode
      auditSourceID: auditSourceID
    
    this.body = responseObject
  catch e
    utils.logAndSetResponse this, 500, "Could not retrieve audits filter options via the API: #{e}", 'error'

  
