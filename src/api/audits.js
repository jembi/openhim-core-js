// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import { Audit } from '../model/audits';
import { AuditMeta } from '../model/audits';
import authorisation from './authorisation';
import Q from 'q';
import logger from 'winston';
import utils from "../utils";
import atna from 'atna-audit';
import auditing from '../auditing';
import os from 'os';
import config from "../config/config";
config.router = config.get('router');
config.api = config.get('api');
let himSourceID = config.get('auditing').auditEvents.auditSourceID;


// function to construct projection object
let getProjectionObject = function(filterRepresentation) {
  switch (filterRepresentation) {
    case "simpledetails":
      // view minimum required data for audit details view
      return {};
    case "full":
      // view all audit data
      return {};
    default:
      // no filterRepresentation supplied - simple view
      // view minimum required data for audits
      return { "participantObjectIdentification": 0, "activeParticipant": 0, "rawMessage": 0 };
  }
};
 

// Audit the audit record retrieval
let auditLogUsed = function(auditId, outcome, user) {
  let groups = user.groups.join(',');
  let uri = `https://${config.router.externalHostname}:${config.api.httpsPort}/audits/${auditId}`;
  let audit = atna.auditLogUsedAudit(outcome, himSourceID, os.hostname(), user.email, groups, groups, uri);
  audit = atna.wrapInSyslog(audit);
  return auditing.sendAuditEvent(audit, () => logger.debug(`Processed audit log used message for user '${user.email}' and audit '${auditId}'`));
};


/*
 * Adds a Audit
 */
export function addAudit() {
  // Test if the user is authorised
  if (!authorisation.inGroup('admin', this.authenticated)) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to addAudit denied.`, 'info');
    return;
  }

  let auditData = this.request.body;

  try {
    let audit = new Audit(auditData);
    let result = {}; //TODO:Fix yield Q.ninvoke audit, 'save'
    ({}); //TODO:Fix yield Q.ninvoke auditing, 'processAuditMeta', audit
    
    logger.info(`User ${this.authenticated.email} created audit with id ${audit.id}`);
    this.body = 'Audit successfully created';
    return this.status = 201;
  } catch (e) {
    logger.error(`Could not add a audit via the API: ${e.message}`);
    this.body = e.message;
    return this.status = 400;
  }
}




/*
 * Retrieves the list of Audits
 */
export function getAudits() {
  // Must be admin
  if (!authorisation.inGroup('admin', this.authenticated)) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to getAudits denied.`, 'info');
    return;
  }

  try {

    let filters;
    let filtersObject = this.request.query;

    //get limit and page values
    let filterLimit = filtersObject.filterLimit != null ? filtersObject.filterLimit : 0;
    let filterPage = filtersObject.filterPage != null ? filtersObject.filterPage : 0;
    let { filterRepresentation } = filtersObject;

    //remove limit/page/filterRepresentation values from filtersObject (Not apart of filtering and will break filter if present)
    delete filtersObject.filterLimit;
    delete filtersObject.filterPage;
    delete filtersObject.filterRepresentation;

    //determine skip amount
    let filterSkip = filterPage*filterLimit;

    // get projection object
    let projectionFiltersObject = getProjectionObject(filterRepresentation);

    if (filtersObject.filters != null) {
      filters = JSON.parse(filtersObject.filters);
    } else {
      filters = {};
    }

    // parse date to get it into the correct format for querying
    if (filters['eventIdentification.eventDateTime']) {
      filters['eventIdentification.eventDateTime'] = JSON.parse(filters['eventIdentification.eventDateTime']);
    }

    if (filters['participantObjectIdentification.participantObjectID']) {
      // filter by AND on same property for patientID and objectID
      if (filters['participantObjectIdentification.participantObjectID'].type) {
        let patientID = new RegExp(filters['participantObjectIdentification.participantObjectID'].patientID);
        let objectID = new RegExp(filters['participantObjectIdentification.participantObjectID'].objectID);
        filters['$and'] = [ { 'participantObjectIdentification.participantObjectID': patientID }, { 'participantObjectIdentification.participantObjectID': objectID } ];
        // remove participantObjectIdentification.participantObjectID property as we create a new '$and' operator
        delete filters['participantObjectIdentification.participantObjectID'];
      } else {
        let participantObjectID = JSON.parse(filters['participantObjectIdentification.participantObjectID']);
        filters['participantObjectIdentification.participantObjectID'] = new RegExp(`${participantObjectID}`);
      }
    }

    // execute the query
    this.body = {} //TODO:Fix yield Audit
      .find(filters, projectionFiltersObject)
      .skip(filterSkip)
      .limit(parseInt(filterLimit))
      .sort({'eventIdentification.eventDateTime': -1})
      .exec();

    // audit each retrieved record, but only for non-basic representation requests
    if ((filterRepresentation === 'full') || (filterRepresentation === 'simpledetails')) {
      return Array.from(this.body).map((record) =>
        auditLogUsed(record._id, atna.OUTCOME_SUCCESS, this.authenticated));
    }

  } catch (e) {
    return utils.logAndSetResponse(this, 500, `Could not retrieve audits via the API: ${e}`, 'error');
  }
}


/*
 * Retrieves the details for a specific Audit Record
 */
export function getAuditById(auditId) {
  // Must be admin
  if (!authorisation.inGroup('admin', this.authenticated)) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to getAuditById denied.`, 'info');
    return;
  }

  // Get the values to use
  auditId = unescape(auditId);

  try {
    // get projection object
    let projectionFiltersObject = getProjectionObject('full');

    let result = {}; //TODO:Fix yield Audit.findById(auditId, projectionFiltersObject).exec()

    // Test if the result if valid
    if (!result) {
      this.body = `Could not find audits record with ID: ${auditId}`;
      this.status = 404;
      return auditLogUsed(auditId, atna.OUTCOME_MINOR_FAILURE, this.authenticated);
    } else {
      this.body = result;
      return auditLogUsed(auditId, atna.OUTCOME_SUCCESS, this.authenticated);
    }

  } catch (e) {
    utils.logAndSetResponse(this, 500, `Could not get audit by ID via the API: ${e}`, 'error');
    return auditLogUsed(auditId, atna.OUTCOME_MAJOR_FAILURE, this.authenticated);
  }
}



/*
 * construct audit filtering dropdown options
 */
export function getAuditsFilterOptions() {

  // Must be admin
  if (!authorisation.inGroup('admin', this.authenticated)) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to getAudits denied.`, 'info');
    return;
  }

  try {
    return this.body = {}; //TODO:Fix yield AuditMeta.findOne({}).exec()
  } catch (e) {
    return utils.logAndSetResponse(this, 500, `Could not retrieve audits filter options via the API: ${e}`, 'error');
  }
}

  
