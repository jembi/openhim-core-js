// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import { User } from '../model/users';
import crypto from 'crypto';
import logger from 'winston';
import config from "../config/config";
config.api = config.get('api');
config.auditing = config.get('auditing');
let atna = require('atna-audit');
let auditing = require('../auditing');
let os = require('os');
let himSourceID = config.auditing.auditEvents.auditSourceID;

// will NOT audit any successful logins on the following paths (specified as regex patterns)
// only 'noisy' endpoints should be included, such as heartbeats or endpoints that get polled
//
// /transactions is treated as a special case - see below
let auditingExemptPaths = [
  /\/tasks/,
  /\/events.*/,
  /\/metrics.*/,
  /\/mediators\/.*\/heartbeat/,
  /\/audits/,
  /\/logs/
];

let isUndefOrEmpty = string => (string == null) || (string === '');

export function authenticate(next) {

  let { header } = this.request;
  let email = header['auth-username'];
  let authTS = header['auth-ts'];
  let authSalt = header['auth-salt'];
  let authToken = header['auth-token'];

  let auditAuthFailure = function() {
    let audit = atna.userLoginAudit(atna.OUTCOME_SERIOUS_FAILURE, himSourceID, os.hostname(), email);
    audit = atna.wrapInSyslog(audit);
    return auditing.sendAuditEvent(audit, () => logger.debug('Processed internal audit'));
  };

  // if any of the required headers aren't present
  if (isUndefOrEmpty(email) || isUndefOrEmpty(authTS) || isUndefOrEmpty(authSalt) || isUndefOrEmpty(authToken)) {
    logger.info(`API request made by ${email} from ${this.request.host} is missing required API authentication headers, denying access`);
    this.status = 401;
    auditAuthFailure();
    return;
  }

  // check if request is recent
  let requestDate = new Date(Date.parse(authTS));

  let authWindowSeconds = config.api.authWindowSeconds != null ? config.api.authWindowSeconds : 10;
  let to = new Date();
  to.setSeconds(to.getSeconds() + authWindowSeconds);
  let from = new Date();
  from.setSeconds(from.getSeconds() - authWindowSeconds);

  if ((requestDate < from) || (requestDate > to)) {
    // request expired
    logger.info(`API request made by ${email} from ${this.request.host} has expired, denying access`);
    this.status = 401;
    auditAuthFailure();
    return;
  }

  let user = {}; //TODO:Fix yield User.findOne(email: email).exec()
  this.authenticated = user;

  if (!user) {
    // not authenticated - user not found
    logger.info(`No user exists for ${email}, denying access to API, request originated from ${this.request.host}`);
    this.status = 401;
    auditAuthFailure();
    return;
  }

  let hash = crypto.createHash('sha512');
  hash.update(user.passwordHash);
  hash.update(authSalt);
  hash.update(authTS);

  if (authToken === hash.digest('hex')) {
    // authenticated

    if (this.path === '/transactions') {
      if (!this.query.filterRepresentation || (this.query.filterRepresentation !== 'full')) {
        // exempt from auditing success
        ({}); //TODO:Fix yield next
        return;
      }
    } else {
      for (let pathTest of Array.from(auditingExemptPaths)) {
        if (pathTest.test(this.path)) {
          // exempt from auditing success
          ({}); //TODO:Fix yield next
          return;
        }
      }
    }

    // send audit
    let audit = atna.userLoginAudit(atna.OUTCOME_SUCCESS, himSourceID, os.hostname(), email, user.groups.join(','), user.groups.join(','));
    audit = atna.wrapInSyslog(audit);
    auditing.sendAuditEvent(audit, () => logger.debug('Processed internal audit'));
    return {}; //TODO:Fix yield next
  } else {
    // not authenticated - token mismatch
    logger.info(`API token did not match expected value, denying access to API, the request was made by ${email} from ${this.request.host}`);
    this.status = 401;
    return auditAuthFailure();
  }
}
