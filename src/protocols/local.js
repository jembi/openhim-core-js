import logger from 'winston'

import {UserModelAPI} from '../model'
import {validatePassword} from '../utils'
import {PassportModelAPI} from '../model/passport'

/**
 * Local Authentication Protocol
 *
 * The most widely used way for websites to authenticate users is via a username
 * and/or email as well as a password. This module provides functions both for
 * registering entirely new users, assigning passwords to already registered
 * users and validating login requesting.
 *
 * For more information on local authentication in Passport.js, check out:
 * http://passportjs.org/guide/username-password/
 */

/**
 * Validate a login request
 *
 * Looks up a user using the supplied identifier (email or username) and then
 * attempts to find a local Passport associated with the user. If a Passport is
 * found, its password is checked against the password supplied in the form.
 *
 */
export const login = async function (email, password, next) {
  await UserModelAPI.findOne({email}, async function (err, user) {
    if (err) {
      logger.error(err)
      return next(null, false)
    }

    if (!user) {
      logger.error(`No user exists for ${email}, denying access to API`)
      return next(null, false)
    }

    await PassportModelAPI.findOne(
      {
        protocol: 'local',
        user: user.id
      },
      function (err, passport) {
        if (err) {
          logger.error(err)
          return next(null, false)
        }
        if (passport) {
          validatePassword(passport, password, function (err, res) {
            if (err || !res) {
              logger.error(
                `Wrong password entered by ${email}, denying access to API ${err}`
              )
              return next(null, false)
            } else {
              return next(null, user)
            }
          })
        } else {
          logger.error(`Password not set for ${email}, denying access to API`)
          return next(null, false)
        }
      }
    )
  })
}
