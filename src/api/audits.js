'use strict'

import atna from 'atna-audit'
import logger from 'winston'
import os from 'os'

import * as auditing from '../auditing'
import * as utils from '../utils'
import {AuditMetaModel, AuditModel} from '../model/audits'
import {config} from '../config'
import {promisify} from 'util'

config.router = config.get('router')
config.api = config.get('api')
const himSourceID = config.get('auditing').auditEvents.auditSourceID
const processAuditMeta = promisify(auditing.processAuditMeta)

// function to construct projection object
function getProjectionObject(filterRepresentation) {
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
      return {
        participantObjectIdentification: 0,
        activeParticipant: 0,
        rawMessage: 0
      }
  }
}

// Audit the audit record retrieval
function auditLogUsed(auditId, outcome, user) {
  const groups = user.groups.join(',')
  const uri = `${config.api.protocol}://${config.router.externalHostname}:${config.api.port}/audits/${auditId}`
  let audit = atna.construct.auditLogUsedAudit(
    outcome,
    himSourceID,
    os.hostname(),
    user.email,
    groups,
    groups,
    uri
  )
  audit = atna.construct.wrapInSyslog(audit)
  return auditing.sendAuditEvent(audit, () =>
    logger.debug(
      `Processed audit log used message for user '${user.email}' and audit '${auditId}'`
    )
  )
}

/*
 * Adds a Audit
 */
export async function addAudit(ctx) {
  try {
    const authorised = await utils.checkUserPermission(ctx, 'addAudit', 'audit-trail-manage')

    if (!authorised) return

    const auditData = ctx.request.body

    const audit = new AuditModel(auditData)
    await audit.save()
    await processAuditMeta(audit)

    logger.info(
      `User ${ctx.authenticated.email} created audit with id ${audit.id}`
    )
    ctx.body = 'Audit successfully created'
    ctx.status = 201
  } catch (e) {
    logger.error(`Could not add a audit via the API: ${e.message}`)
    ctx.body = e.message
    ctx.status = 400
  }
}

function checkPatientID(patientID) {
  return new RegExp('^[\\d\\w\\-]*$').test(patientID) //PatientID should only be alpha numerical and may contain hyphens
}

/*
 * Retrieves the list of Audits
 */
export async function getAudits(ctx) {
  try {
    const authorised = await utils.checkUserPermission(ctx, 'getAudits', 'audit-trail-view')

    if (!authorised) return

    let filters
    const filtersObject = ctx.request.query

    // get limit and page values
    const filterLimit =
      filtersObject.filterLimit != null ? filtersObject.filterLimit : 0
    const filterPage =
      filtersObject.filterPage != null ? filtersObject.filterPage : 0
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
      filters['eventIdentification.eventDateTime'] = JSON.parse(
        filters['eventIdentification.eventDateTime']
      )
    }

    if (filters['participantObjectIdentification.participantObjectID']) {
      // filter by AND on same property for patientID and objectID
      if (filters['participantObjectIdentification.participantObjectID'].type) {
        const patientID = JSON.parse(
          filters['participantObjectIdentification.participantObjectID']
            .patientID
        )
        if (checkPatientID(patientID.substring(0, patientID.indexOf('\\^')))) {
          const patientIDRegEx = new RegExp(patientID)
          const objectIDRegEx = new RegExp(
            filters[
              'participantObjectIdentification.participantObjectID'
            ].objectID
          )
          filters.$and = [
            {
              'participantObjectIdentification.participantObjectID':
                patientIDRegEx
            },
            {
              'participantObjectIdentification.participantObjectID':
                objectIDRegEx
            }
          ]
          // remove participantObjectIdentification.participantObjectID property as we create a new '$and' operator
          delete filters['participantObjectIdentification.participantObjectID']
        } else {
          utils.logAndSetResponse(
            ctx,
            400,
            `Special characters (except for hyphens(-)) not allowed in PatientID filter field`,
            'error'
          )
          return
        }
      } else {
        const participantObjectID = JSON.parse(
          filters['participantObjectIdentification.participantObjectID']
        )
        if (
          checkPatientID(
            participantObjectID.substring(0, participantObjectID.indexOf('\\^'))
          )
        ) {
          filters['participantObjectIdentification.participantObjectID'] =
            new RegExp(`${participantObjectID}`)
        } else {
          utils.logAndSetResponse(
            ctx,
            400,
            `Special characters (except for hyphens(-)) not allowed in PatientID filter field`,
            'error'
          )
          return
        }
      }
    }

    // execute the query
    ctx.body = await AuditModel.find(filters, projectionFiltersObject)
      .skip(filterSkip)
      .limit(parseInt(filterLimit, 10))
      .sort({'eventIdentification.eventDateTime': -1})
      .exec()

    // audit each retrieved record, but only for non-basic representation requests
    if (
      filterRepresentation === 'full' ||
      filterRepresentation === 'simpledetails'
    ) {
      Array.from(ctx.body).map(record =>
        auditLogUsed(
          record._id,
          atna.constants.OUTCOME_SUCCESS,
          ctx.authenticated
        )
      )
    }
  } catch (e) {
    utils.logAndSetResponse(
      ctx,
      500,
      `Could not retrieve audits via the API: ${e}`,
      'error'
    )
  }
}

/*
 * Retrieves the details for a specific Audit Record
 */
export async function getAuditById(ctx, auditId) {
  try {
    const authorised = await utils.checkUserPermission(ctx, 'getAuditById', 'audit-trail-view')

    if (!authorised) return

    // Get the values to use
    auditId = unescape(auditId)

    // get projection object
    const projectionFiltersObject = getProjectionObject('full')

    const result = await AuditModel.findById(
      auditId,
      projectionFiltersObject
    ).exec()

    // Test if the result if valid
    if (!result) {
      ctx.body = `Could not find audits record with ID: ${auditId}`
      ctx.status = 404
      return auditLogUsed(
        auditId,
        atna.constants.OUTCOME_MINOR_FAILURE,
        ctx.authenticated
      )
    } else {
      ctx.body = result
      return auditLogUsed(
        auditId,
        atna.constants.OUTCOME_SUCCESS,
        ctx.authenticated
      )
    }
  } catch (e) {
    utils.logAndSetResponse(
      ctx,
      500,
      `Could not get audit by ID via the API: ${e}`,
      'error'
    )
    auditLogUsed(
      auditId,
      atna.constants.OUTCOME_MAJOR_FAILURE,
      ctx.authenticated
    )
  }
}

/*
 * construct audit filtering dropdown options
 */
export async function getAuditsFilterOptions(ctx) {
  try {
    const authorised = await utils.checkUserPermission(ctx, 'getAuditsFilterOptions', 'audit-trail-view')

    if (!authorised) return

    ctx.body = await AuditMetaModel.findOne({}).exec()
  } catch (e) {
    utils.logAndSetResponse(
      ctx,
      500,
      `Could not retrieve audits filter options via the API: ${e}`,
      'error'
    )
  }
}
