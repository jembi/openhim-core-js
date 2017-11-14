import crypto from 'crypto'
import logger from 'winston'
import atna from 'atna-audit'
import os from 'os'
import { UserModelAPI } from '../model/users'
import { config } from '../config'
import * as auditing from '../auditing'
import { caseInsensitiveRegex } from '../utils'

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

export async function authenticate (ctx, next) {
  const { header } = ctx.request
  const email = header['auth-username']
  const authTS = header['auth-ts']
  const authSalt = header['auth-salt']
  const authToken = header['auth-token']

  function auditAuthFailure () {
    let audit = atna.construct.userLoginAudit(atna.constants.OUTCOME_SERIOUS_FAILURE, himSourceID, os.hostname(), email)
    audit = atna.construct.wrapInSyslog(audit)
    return auditing.sendAuditEvent(audit, () => logger.debug('Processed internal audit'))
  }

  // if any of the required headers aren't present
  if (isUndefOrEmpty(email) || isUndefOrEmpty(authTS) || isUndefOrEmpty(authSalt) || isUndefOrEmpty(authToken)) {
    logger.info(`API request made by ${email} from ${ctx.request.host} is missing required API authentication headers, denying access`)
    ctx.status = 401
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
    logger.info(`API request made by ${email} from ${ctx.request.host} has expired, denying access`)
    ctx.status = 401
    auditAuthFailure()
    return
  }
  const user = await UserModelAPI.findOne({ email: caseInsensitiveRegex(email) })
  ctx.authenticated = user

  if (!user) {
    // not authenticated - user not found
    logger.info(`No user exists for ${email}, denying access to API, request originated from ${ctx.request.host}`)
    ctx.status = 401
    auditAuthFailure()
    return
  }

  const hash = crypto.createHash('sha512')
  hash.update(user.passwordHash)
  hash.update(authSalt)
  hash.update(authTS)

  if (authToken === hash.digest('hex')) {
    // authenticated

    if (ctx.path === '/transactions') {
      if (!ctx.query.filterRepresentation || (ctx.query.filterRepresentation !== 'full')) {
        // exempt from auditing success
        await next()
        return
      }
    } else {
      for (const pathTest of Array.from(auditingExemptPaths)) {
        if (pathTest.test(ctx.path)) {
          // exempt from auditing success
          await next()
          return
        }
      }
    }

    // send audit
    let audit = atna.construct.userLoginAudit(atna.constants.OUTCOME_SUCCESS, himSourceID, os.hostname(), email, user.groups.join(','), user.groups.join(','))
    audit = atna.construct.wrapInSyslog(audit)
    auditing.sendAuditEvent(audit, () => logger.debug('Processed internal audit'))
    await next()
  } else {
    // not authenticated - token mismatch
    logger.info(`API token did not match expected value, denying access to API, the request was made by ${email} from ${ctx.request.host}`)
    ctx.status = 401
    return auditAuthFailure()
  }
}
