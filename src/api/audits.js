import logger from 'winston'
import atna from 'atna-audit'
import os from 'os'
import { AuditModel, AuditMetaModel } from '../model/audits'
import * as authorisation from './authorisation'
import * as utils from '../utils'
import * as auditing from '../auditing'
import { config } from '../config'
import { promisify } from 'util'

config.router = config.get('router')
config.api = config.get('api')
const himSourceID = config.get('auditing').auditEvents.auditSourceID
const processAuditMeta = promisify(auditing.processAuditMeta)

// function to construct projection object
function getProjectionObject (filterRepresentation) {
  switch (filterRepresentation) {
    case 'simpledetails':
      // view minimum required data for audit details view
      return {}
    case 'full':
      // view all audit data
      return {}
    default:
      // no filterRepresentation supplied - simple view
      // view minimum required data for audits
      return {participantObjectIdentification: 0, activeParticipant: 0, rawMessage: 0}
  }
}

// Audit the audit record retrieval
function auditLogUsed (auditId, outcome, user) {
  const groups = user.groups.join(',')
  const uri = `https://${config.router.externalHostname}:${config.api.httpsPort}/audits/${auditId}`
  let audit = atna.construct.auditLogUsedAudit(outcome, himSourceID, os.hostname(), user.email, groups, groups, uri)
  audit = atna.construct.wrapInSyslog(audit)
  return auditing.sendAuditEvent(audit, () => logger.debug(`Processed audit log used message for user '${user.email}' and audit '${auditId}'`))
}

/*
 * Adds a Audit
 */
export async function addAudit (ctx) {
  // Test if the user is authorised
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to addAudit denied.`, 'info')
    return
  }

  const auditData = ctx.request.body

  try {
    const audit = new AuditModel(auditData)
    await audit.save()
    await processAuditMeta(audit)

    logger.info(`User ${ctx.authenticated.email} created audit with id ${audit.id}`)
    ctx.body = 'Audit successfully created'
    ctx.status = 201
  } catch (e) {
    logger.error(`Could not add a audit via the API: ${e.message}`)
    ctx.body = e.message
    ctx.status = 400
  }
}

/*
 * Retrieves the list of Audits
 */
export async function getAudits (ctx) {
  // Must be admin
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to getAudits denied.`, 'info')
    return
  }

  try {
    let filters
    const filtersObject = ctx.request.query

    // get limit and page values
    const filterLimit = filtersObject.filterLimit != null ? filtersObject.filterLimit : 0
    const filterPage = filtersObject.filterPage != null ? filtersObject.filterPage : 0
    const {filterRepresentation} = filtersObject

    // remove limit/page/filterRepresentation values from filtersObject (Not apart of filtering and will break filter if present)
    delete filtersObject.filterLimit
    delete filtersObject.filterPage
    delete filtersObject.filterRepresentation

    // determine skip amount
    const filterSkip = filterPage * filterLimit

    // get projection object
    const projectionFiltersObject = getProjectionObject(filterRepresentation)

    if (filtersObject.filters != null) {
      filters = JSON.parse(filtersObject.filters)
    } else {
      filters = {}
    }

    // parse date to get it into the correct format for querying
    if (filters['eventIdentification.eventDateTime']) {
      filters['eventIdentification.eventDateTime'] = JSON.parse(filters['eventIdentification.eventDateTime'])
    }

    if (filters['participantObjectIdentification.participantObjectID']) {
      // filter by AND on same property for patientID and objectID
      if (filters['participantObjectIdentification.participantObjectID'].type) {
        const patientID = new RegExp(filters['participantObjectIdentification.participantObjectID'].patientID)
        const objectID = new RegExp(filters['participantObjectIdentification.participantObjectID'].objectID)
        filters.$and = [{'participantObjectIdentification.participantObjectID': patientID}, {'participantObjectIdentification.participantObjectID': objectID}]
        // remove participantObjectIdentification.participantObjectID property as we create a new '$and' operator
        delete filters['participantObjectIdentification.participantObjectID']
      } else {
        const participantObjectID = JSON.parse(filters['participantObjectIdentification.participantObjectID'])
        filters['participantObjectIdentification.participantObjectID'] = new RegExp(`${participantObjectID}`)
      }
    }

    // execute the query
    ctx.body = await AuditModel
      .find(filters, projectionFiltersObject)
      .skip(filterSkip)
      .limit(parseInt(filterLimit, 10))
      .sort({'eventIdentification.eventDateTime': -1})
      .exec()

    // audit each retrieved record, but only for non-basic representation requests
    if ((filterRepresentation === 'full') || (filterRepresentation === 'simpledetails')) {
      Array.from(ctx.body).map((record) => auditLogUsed(record._id, atna.constants.OUTCOME_SUCCESS, ctx.authenticated))
    }
  } catch (e) {
    utils.logAndSetResponse(ctx, 500, `Could not retrieve audits via the API: ${e}`, 'error')
  }
}

/*
 * Retrieves the details for a specific Audit Record
 */
export async function getAuditById (ctx, auditId) {
  // Must be admin
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to getAuditById denied.`, 'info')
    return
  }

  // Get the values to use
  auditId = unescape(auditId)

  try {
    // get projection object
    const projectionFiltersObject = getProjectionObject('full')

    const result = await AuditModel.findById(auditId, projectionFiltersObject).exec()

    // Test if the result if valid
    if (!result) {
      ctx.body = `Could not find audits record with ID: ${auditId}`
      ctx.status = 404
      return auditLogUsed(auditId, atna.constants.OUTCOME_MINOR_FAILURE, ctx.authenticated)
    } else {
      ctx.body = result
      return auditLogUsed(auditId, atna.constants.OUTCOME_SUCCESS, ctx.authenticated)
    }
  } catch (e) {
    utils.logAndSetResponse(ctx, 500, `Could not get audit by ID via the API: ${e}`, 'error')
    auditLogUsed(auditId, atna.constants.OUTCOME_MAJOR_FAILURE, ctx.authenticated)
  }
}

/*
 * construct audit filtering dropdown options
 */
export async function getAuditsFilterOptions (ctx) {
  // Must be admin
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to getAudits denied.`, 'info')
    return
  }

  try {
    ctx.body = await AuditMetaModel.findOne({}).exec()
  } catch (e) {
    utils.logAndSetResponse(ctx, 500, `Could not retrieve audits filter options via the API: ${e}`, 'error')
  }
}
