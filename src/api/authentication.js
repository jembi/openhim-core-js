'use strict'

import atna from 'atna-audit'
import basicAuth from 'basic-auth'
import crypto from 'crypto'
import logger from 'winston'
import os from 'os'

import * as auditing from '../auditing'
import * as authorisation from './authorisation'
import {UserModelAPI} from '../model/users'
import {caseInsensitiveRegex, logAndSetResponse} from '../utils'
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

const isUndefOrEmpty = string => string == null || string === ''

async function authenticateBasic(ctx) {
  const credentials = basicAuth(ctx)
  if (credentials == null) {
    // No basic auth details found
    return null
  }
  const {name: email, pass: password} = credentials
  const user = await UserModelAPI.findOne({
    email: caseInsensitiveRegex(email)
  })
  if (user == null) {
    // not authenticated - user not found
    ctx.throw(
      401,
      `No user exists for ${email}, denying access to API, request originated from ${ctx.request.host}`,
      {email}
    )
  }

  const hash = crypto.createHash(user.passwordAlgorithm)
  hash.update(user.passwordSalt)
  hash.update(password)
  if (user.passwordHash !== hash.digest('hex')) {
    // not authenticated - password mismatch
    ctx.throw(
      401,
      `Password did not match expected value, denying access to API, the request was made by ${email} from ${ctx.request.host}`,
      {email}
    )
  }
  return user
}

async function authenticateToken(ctx) {
  const {header} = ctx.request
  const email = header['auth-username']
  const authTS = header['auth-ts']
  const authSalt = header['auth-salt']
  const authToken = header['auth-token']

  // if any of the required headers aren't present
  if (
    isUndefOrEmpty(email) ||
    isUndefOrEmpty(authTS) ||
    isUndefOrEmpty(authSalt) ||
    isUndefOrEmpty(authToken)
  ) {
    ctx.throw(
      401,
      `API request made by ${email} from ${ctx.request.host} is missing required API authentication headers, denying access`,
      {email}
    )
  }

  // check if request is recent
  const requestDate = new Date(Date.parse(authTS))

  const authWindowSeconds =
    config.api.authWindowSeconds != null ? config.api.authWindowSeconds : 10
  const to = new Date()
  to.setSeconds(to.getSeconds() + authWindowSeconds)
  const from = new Date()
  from.setSeconds(from.getSeconds() - authWindowSeconds)

  if (requestDate < from || requestDate > to) {
    // request expired
    ctx.throw(
      401,
      `API request made by ${email} from ${ctx.request.host} has expired, denying access`,
      {email}
    )
  }

  const user = await UserModelAPI.findOne({
    email: caseInsensitiveRegex(email)
  })
  if (user == null) {
    // not authenticated - user not found
    ctx.throw(
      401,
      `No user exists for ${email}, denying access to API, request originated from ${ctx.request.host}`,
      {email}
    )
  }

  const hash = crypto.createHash('sha512')
  hash.update(user.passwordHash)
  hash.update(authSalt)
  hash.update(authTS)

  if (authToken !== hash.digest('hex')) {
    // not authenticated - token mismatch
    ctx.throw(
      401,
      `API token did not match expected value, denying access to API, the request was made by ${email} from ${ctx.request.host}`,
      {email}
    )
  }

  return user
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

function isAuthenticationTypeEnabled(type) {
  return getEnabledAuthenticationTypesFromConfig(config).includes(type)
}

async function authenticateRequest(ctx) {
  let user
  // First attempt basic authentication if enabled
  if (user == null && isAuthenticationTypeEnabled('basic')) {
    user = await authenticateBasic(ctx)
  }
  // Otherwise try token based authentication if enabled
  if (user == null && isAuthenticationTypeEnabled('token')) {
    user = await authenticateToken(ctx)
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
  let user
  try {
    user = await authenticateRequest(ctx)
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
        err.email
      )
      audit = atna.construct.wrapInSyslog(audit)
      auditing.sendAuditEvent(audit, handleAuditResponse)
      return
    }
    // Rethrow other errors
    throw err
  }

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
    user.email,
    user.groups.join(','),
    user.groups.join(',')
  )
  audit = atna.construct.wrapInSyslog(audit)
  auditing.sendAuditEvent(audit, handleAuditResponse)

  return next()
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
