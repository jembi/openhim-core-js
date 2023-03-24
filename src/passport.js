import _ from 'lodash'
import logger from 'winston'

import passport from 'koa-passport'
import * as passportLocal from 'passport-local'
import * as passportHttp from 'passport-http'
import * as passportCustom from 'passport-custom'
import {isAuthenticationTypeEnabled} from './api/authentication'
import {local, basic, token} from './protocols'
import {UserModelAPI} from './model'

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
 * Load Strategies: Local and Basic
 *
 */
passport.loadStrategies = function () {
  var strategies = {
    local: {
      strategy: passportLocal.Strategy
    },
    basic: {
      strategy: passportHttp.BasicStrategy
    },
    token: {
      strategy: passportCustom.Strategy
    }
    // TODO: Add openid
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
