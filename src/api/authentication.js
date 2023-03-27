'use strict'

import atna from 'atna-audit'
import logger from 'winston'
import os from 'os'

import * as auditing from '../auditing'
import * as authorisation from './authorisation'
import passport from '../passport'
import {logAndSetResponse} from '../utils'
import {config} from '../config'
import {
  BASIC_AUTH_TYPE,
  CUSTOM_TOKEN_AUTH_TYPE,
  JWT_AUTH_TYPE,
  MUTUAL_TLS_AUTH_TYPE
} from '../constants'

config.api = config.get('api')
config.auditing = config.get('auditing')
config.authentication = config.get('authentication')
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

async function authenticateBasic(ctx) {
  // Basic auth using middleware
  await passport.authenticate('basic', function (err, user) {
    if (user) {
      ctx.req.user = user
      ctx.body = 'User Authenticated Successfully'
      ctx.status = 200
    }
  })(ctx, () => {})

  return ctx.req.user || null
}

/**
 * @deprecated
 */
async function authenticateToken(ctx) {
  await passport.authenticate('token')(ctx, () => {})

  return ctx.req.user || null
}

function getEnabledAuthenticationTypesFromConfig(config) {
  if (Array.isArray(config.api.authenticationTypes)) {
    return config.api.authenticationTypes
  }
  try {
    // Attempt to parse the authentication types as JSON
    // e.g. if configured through an environment variable
    const enabledTypes = JSON.parse(config.api.authenticationTypes)
    if (Array.isArray(enabledTypes)) {
      return enabledTypes
    }
  } catch (err) {
    // Squash parsing errors
  }
  logger.warn(
    `Invalid value for API authenticationTypes config: ${config.api.authenticationTypes}`
  )
  return []
}

export function isAuthenticationTypeEnabled(type) {
  return getEnabledAuthenticationTypesFromConfig(config).includes(type)
}

function requestType(ctx, type) {
  const {headers} = ctx.request

  if (
    headers['auth-username'] ||
    headers['auth-ts'] ||
    headers['auth-salt'] ||
    headers['auth-token']
  ) {
    return type === 'token'
  } else if (headers.authorization && headers.authorization.includes('Basic')) {
    return type === 'basic'
  }
  return false
}

async function authenticateRequest(ctx) {
  let user = null

  // First attempt local or openid authentication if enabled
  if (ctx.req.user) {
    user = ctx.req.user
  }
  // Otherwise try token based authentication if enabled (@deprecated)
  if (user == null && requestType(ctx, 'token')) {
    user = await authenticateToken(ctx)
  }
  // Otherwise try basic based authentication if enabled
  if (user == null && requestType(ctx, 'basic')) {
    // Basic auth using middleware
    user = await authenticateBasic(ctx)
  }
  // User could not be authenticated
  if (user == null) {
    const enabledTypes =
      getEnabledAuthenticationTypesFromConfig(config).join(', ')
    ctx.throw(
      401,
      `API request could not be authenticated with configured authentication types: "${enabledTypes}"`
    )
  }
  return user
}

function handleAuditResponse(err) {
  if (err) {
    logger.error('Sending audit event failed', err)
    return
  }
  logger.debug('Processed internal audit')
}

export async function authenticate(ctx, next) {
  try {
    // Authenticate Request either by basic or local or token
    const user = await authenticateRequest(ctx)

    if (ctx.isAuthenticated()) {
      // Set the user on the context for consumption by other middleware
      ctx.authenticated = user

      // Deal with paths exempt from audit
      if (ctx.path === '/transactions') {
        if (
          !ctx.query.filterRepresentation ||
          ctx.query.filterRepresentation !== 'full'
        ) {
          // exempt from auditing success
          return next()
        }
      } else {
        for (const pathTest of auditingExemptPaths) {
          if (pathTest.test(ctx.path)) {
            // exempt from auditing success
            return next()
          }
        }
      }
      // Send an auth success audit event
      let audit = atna.construct.userLoginAudit(
        atna.constants.OUTCOME_SUCCESS,
        himSourceID,
        os.hostname(),
        ctx.authenticated.email,
        ctx.authenticated.groups.join(','),
        ctx.authenticated.groups.join(',')
      )
      audit = atna.construct.wrapInSyslog(audit)
      auditing.sendAuditEvent(audit, handleAuditResponse)

      return next()
    } else {
      ctx.throw(
        401,
        `Denying access for an API request from ${ctx.request.host}`
      )
    }
  } catch (err) {
    // Handle authentication errors
    if (err.status === 401) {
      logger.info(err.message)
      // Set the status but NOT THE BODY
      // We do not want to expose any sensitive information in the body
      ctx.status = err.status
      // Send an auth failure audit event
      let audit = atna.construct.userLoginAudit(
        atna.constants.OUTCOME_SERIOUS_FAILURE,
        himSourceID,
        os.hostname(),
        `Unknown with ip ${ctx.request.ip}`
      )
      audit = atna.construct.wrapInSyslog(audit)
      auditing.sendAuditEvent(audit, handleAuditResponse)
      return
    }
    // Rethrow other errors
    throw err
  }
}

export async function getEnabledAuthenticationTypes(ctx, next) {
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    logAndSetResponse(
      ctx,
      403,
      `User ${ctx.authenticated.email} is not an admin, API access to get enabled authentication types denied.`,
      'info'
    )
    return next()
  }

  if (!config.authentication || !Object.keys(config.authentication).length) {
    logAndSetResponse(
      ctx,
      500,
      'No authentication enabled, invalid OpenHIM configuration',
      'error'
    )
    return next()
  }

  const enabledAuthTypes = []

  if (config.authentication.enableMutualTLSAuthentication)
    enabledAuthTypes.push(MUTUAL_TLS_AUTH_TYPE)
  if (config.authentication.enableBasicAuthentication)
    enabledAuthTypes.push(BASIC_AUTH_TYPE)
  if (config.authentication.enableCustomTokenAuthentication)
    enabledAuthTypes.push(CUSTOM_TOKEN_AUTH_TYPE)
  if (config.authentication.enableJWTAuthentication)
    enabledAuthTypes.push(JWT_AUTH_TYPE)

  ctx.body = enabledAuthTypes
  ctx.status = 200
  logger.info(
    `User ${ctx.authenticated.email} retrieved the enabled authentication types`
  )
  next()
}

// Exports for testing only
export const _getEnabledAuthenticationTypesFromConfig =
  getEnabledAuthenticationTypesFromConfig
