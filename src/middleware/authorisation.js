'use strict'

import atna from 'atna-audit'
import logger from 'winston'
import os from 'os'

import * as auditing from '../auditing'
import {config} from '../config'
import {promisify} from 'util'

config.authentication = config.get('authentication')
const himSourceID = config.get('auditing').auditEvents.auditSourceID

function genAuthAudit(remoteAddress) {
  let audit = atna.construct.nodeAuthentication(
    remoteAddress,
    himSourceID,
    os.hostname(),
    atna.constants.OUTCOME_MINOR_FAILURE
  )
  audit = atna.construct.wrapInSyslog(audit)
  return audit
}

function authoriseClient(channel, ctx) {
  if (ctx.authenticated != null && channel.allow != null) {
    if (ctx.authenticated.roles != null) {
      for (const role of Array.from(channel.allow)) {
        if (Array.from(ctx.authenticated.roles).includes(role)) {
          return true
        }
      }
    }
    if (Array.from(channel.allow).includes(ctx.authenticated.clientID)) {
      return true
    }
  }

  return false
}

function authoriseIP(channel, ctx) {
  if ((channel.whitelist != null ? channel.whitelist.length : undefined) > 0) {
    return Array.from(channel.whitelist).includes(ctx.ip)
  } else {
    return false
  }
}

export async function authorise(ctx, done) {
  const channel = ctx.matchingChannel

  if (
    channel != null &&
    (channel.authType === 'public' ||
      authoriseClient(channel, ctx) ||
      authoriseIP(channel, ctx))
  ) {
    // authorisation succeeded
    ctx.authorisedChannel = channel
    logger.info(
      `The request, '${ctx.request.path}' is authorised to access ${ctx.authorisedChannel.name}`
    )
  } else if (!channel) {
    // Channel not found
    ctx.response.status = 404
  } else {
    // authorisation failed
    ctx.response.status = 401
    if (config.authentication.enableBasicAuthentication) {
      ctx.set('WWW-Authenticate', 'Basic')
    }
    logger.info(
      `The request, '${ctx.request.path}', is not authorised to access any channels.`
    )
    auditing.sendAuditEvent(genAuthAudit(ctx.ip), () =>
      logger.debug('Processed nodeAuthentication audit')
    )
  }

  return done()
}

export async function koaMiddleware(ctx, next) {
  const _authorise = promisify(authorise)
  await _authorise(ctx)
  if (ctx.authorisedChannel != null) {
    await next()
  }
}

// export private functions for unit testing
// note: you cant spy on these method because of this :(
if (process.env.NODE_ENV === 'test') {
  exports.genAuthAudit = genAuthAudit
}
