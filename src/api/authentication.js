import crypto from 'crypto'
import logger from 'winston'
import atna from 'atna-audit'
import os from 'os'
import { UserModelAPI } from '../model/users'
import { config } from '../config'
import * as auditing from '../auditing'

config.api = config.get('api')
config.auditing = config.get('auditing')
const himSourceID = config.auditing.auditEvents.auditSourceID

// will NOT audit any successful logins on the following paths (specified as regex patterns)
// only 'noisy' endpoints should be included, such as heartbeats or endpoints that get polled
//
// /transactions is treated as a special case - see below
const auditingExemptPaths = [
  /\/tasks/,
  /\/events.*/,
  /\/metrics.*/,
  /\/mediators\/.*\/heartbeat/,
  /\/audits/,
  /\/logs/
]

const isUndefOrEmpty = string => (string == null) || (string === '')

export function * authenticate (next) {
  const { header } = this.request
  const email = header['auth-username']
  const authTS = header['auth-ts']
  const authSalt = header['auth-salt']
  const authToken = header['auth-token']

  function auditAuthFailure () {
    let audit = atna.userLoginAudit(atna.OUTCOME_SERIOUS_FAILURE, himSourceID, os.hostname(), email)
    audit = atna.wrapInSyslog(audit)
    return auditing.sendAuditEvent(audit, () => logger.debug('Processed internal audit'))
  }

    // if any of the required headers aren't present
  if (isUndefOrEmpty(email) || isUndefOrEmpty(authTS) || isUndefOrEmpty(authSalt) || isUndefOrEmpty(authToken)) {
    logger.info(`API request made by ${email} from ${this.request.host} is missing required API authentication headers, denying access`)
    this.status = 401
    auditAuthFailure()
    return
  }

    // check if request is recent
  const requestDate = new Date(Date.parse(authTS))

  const authWindowSeconds = config.api.authWindowSeconds != null ? config.api.authWindowSeconds : 10
  const to = new Date()
  to.setSeconds(to.getSeconds() + authWindowSeconds)
  const from = new Date()
  from.setSeconds(from.getSeconds() - authWindowSeconds)

  if ((requestDate < from) || (requestDate > to)) {
        // request expired
    logger.info(`API request made by ${email} from ${this.request.host} has expired, denying access`)
    this.status = 401
    auditAuthFailure()
    return
  }

  const user = yield UserModelAPI.findOne({ email }).exec()
  this.authenticated = user

  if (!user) {
        // not authenticated - user not found
    logger.info(`No user exists for ${email}, denying access to API, request originated from ${this.request.host}`)
    this.status = 401
    auditAuthFailure()
    return
  }

  const hash = crypto.createHash('sha512')
  hash.update(user.passwordHash)
  hash.update(authSalt)
  hash.update(authTS)

  if (authToken === hash.digest('hex')) {
        // authenticated

    if (this.path === '/transactions') {
      if (!this.query.filterRepresentation || (this.query.filterRepresentation !== 'full')) {
                // exempt from auditing success
        yield next
        return
      }
    } else {
      for (const pathTest of Array.from(auditingExemptPaths)) {
        if (pathTest.test(this.path)) {
                    // exempt from auditing success
          yield next
          return
        }
      }
    }

        // send audit
    let audit = atna.userLoginAudit(atna.OUTCOME_SUCCESS, himSourceID, os.hostname(), email, user.groups.join(','), user.groups.join(','))
    audit = atna.wrapInSyslog(audit)
    auditing.sendAuditEvent(audit, () => logger.debug('Processed internal audit'))
    return yield next
  } else {
        // not authenticated - token mismatch
    logger.info(`API token did not match expected value, denying access to API, the request was made by ${email} from ${this.request.host}`)
    this.status = 401
    return auditAuthFailure()
  }
}
