import _ from 'lodash'
import logger from 'winston'

import passport from 'koa-passport'
import * as passportLocal from 'passport-local'
import * as passportHttp from 'passport-http'
import * as passportCustom from 'passport-custom'
import * as passportOpenid from 'passport-openidconnect'
import MongooseStore from './middleware/sessionStore'
import {isAuthenticationTypeEnabled} from './api/authentication'
import {local, basic, token, openid} from './protocols'
import {UserModelAPI} from './model'
import {config} from './config'

const disabledAuthTypeError = strat =>
  new Error(
    `Could not be authenticaticated, ${strat} authentication type is disabled`
  )

/**
 * Handle passport errors with logger
 *
 */
const handlePassportError = function (err, user, next) {
  if (err) {
    logger.error(err.message)
    next(null, false)
  } else if (!user) {
    return next(null, false)
  } else {
    return next(null, user)
  }
}

/**
 * Load Strategies: Local, Basic and Openid
 *
 */
passport.loadStrategies = function () {
  const {openid: openidConfig} = config.api

  let strategies = {
    local: {
      strategy: passportLocal.Strategy
    },
    basic: {
      strategy: passportHttp.BasicStrategy
    },
    token: {
      strategy: passportCustom.Strategy
    },
    openid: {
      strategy: passportOpenid.Strategy,
      options: {
        issuer: openidConfig.url,
        authorizationURL: `${openidConfig.url}/protocol/openid-connect/auth`,
        tokenURL: `${openidConfig.url}/protocol/openid-connect/token`,
        userInfoURL: `${openidConfig.url}/protocol/openid-connect/userinfo`,
        clientID: openidConfig.clientId,
        clientSecret: openidConfig.clientSecret,
        callbackURL: openidConfig.callbackUrl,
        scope: openidConfig.scope,
        sessionKey: 'openid_session_key',
        passReqToCallback: true,
        profile: true,
        store: new MongooseStore()
      }
    }
  }

  _.each(
    strategies,
    _.bind(async function (strat, key) {
      let Strategy

      if (key === 'local') {
        Strategy = strat.strategy
        passport.use(
          new Strategy(async (username, password, next) => {
            if (isAuthenticationTypeEnabled(key)) {
              return await local.login(username, password, (err, user) =>
                handlePassportError(err, user, next)
              )
            } else {
              return handlePassportError(
                disabledAuthTypeError(key),
                false,
                next
              )
            }
          })
        )
      } else if (key === 'basic') {
        Strategy = strat.strategy
        passport.use(
          new Strategy(async (username, password, next) => {
            if (isAuthenticationTypeEnabled(key)) {
              return await basic.login(username, password, (err, user) =>
                handlePassportError(err, user, next)
              )
            } else {
              return handlePassportError(
                disabledAuthTypeError(key),
                false,
                next
              )
            }
          })
        )
      } else if (key === 'token') {
        Strategy = strat.strategy
        passport.use(
          'token',
          new Strategy(async (req, next) => {
            if (isAuthenticationTypeEnabled(key)) {
              return await token.login(req, (err, user) =>
                handlePassportError(err, user, next)
              )
            } else {
              return handlePassportError(
                disabledAuthTypeError(key),
                false,
                next
              )
            }
          })
        )
      } else if (key === 'openid') {
        Strategy = strat.strategy
        passport.use(
          'openidconnect',
          new Strategy(
            strat.options,
            async (
              req,
              issuer,
              profile,
              context,
              idToken,
              accessToken,
              refreshToken,
              tokens,
              next
            ) => {
              if (isAuthenticationTypeEnabled(key)) {
                return await openid.login(
                  req,
                  issuer,
                  profile,
                  accessToken,
                  tokens,
                  (err, user) => handlePassportError(err, user, next)
                )
              } else {
                return handlePassportError(
                  disabledAuthTypeError(key),
                  false,
                  next
                )
              }
            }
          )
        )
      }
    }, passport)
  )
}

/**
 * Serialize User: used the email to be stored in the session
 *
 */
passport.serializeUser(function (user, next) {
  next(null, user.email)
})

/**
 * Deserialize User
 *
 */
passport.deserializeUser(async function (email, next) {
  try {
    const user = await UserModelAPI.findOne({
      email
    })
    next(null, user)
  } catch (err) {
    next(err, null)
  }
})

export default passport
