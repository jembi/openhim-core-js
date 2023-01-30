import passport from 'koa-passport'
import * as passportLocal from 'passport-local'
import * as passportHttp from 'passport-http'
import _ from 'lodash'
import {local, basic} from './protocols'
import {UserModelAPI} from './model'

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
    _.bind(async function (strategy, key) {
      var Strategy

      if (key === 'local' && strategies.local) {
        Strategy = strategies[key].strategy
        passport.use(
          new Strategy(
            async (username, password, done) =>
              await local.login(username, password, done)
          )
        )
      } else if (key === 'basic' && strategies.basic) {
        Strategy = strategies[key].strategy
        passport.use(
          new Strategy(
            async (username, password, done) =>
              await basic.login(username, password, done)
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
