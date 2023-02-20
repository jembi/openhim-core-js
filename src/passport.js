import _ from 'lodash'
import logger from 'winston'

import passport from 'koa-passport'
import * as passportLocal from 'passport-local'
import * as passportHttp from 'passport-http'
import {local, basic} from './protocols'
import {UserModelAPI} from './model'

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
      strategy: passportHttp.BasicStrategy,
      protocol: 'basic'
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
          new Strategy(
            async (username, password, next) =>
              await local.login(username, password, (err, user) =>
                handlePassportError(err, user, next)
              )
          )
        )
      } else if (key === 'basic') {
        Strategy = strat.strategy
        passport.use(
          new Strategy(
            async (username, password, next) =>
              await basic.login(username, password, (err, user) =>
                handlePassportError(err, user, next)
              )
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
