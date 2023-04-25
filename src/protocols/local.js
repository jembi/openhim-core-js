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
  return await UserModelAPI.findOne({email})
    .then(function (user) {
      if (!user) {
        return next(
          new Error(`No user exists for ${email}, denying access to API`),
          false
        )
      }
      return PassportModelAPI.findOne({
        protocol: user.provider === 'token' ? 'token' : 'local',
        email: user.email
      })
        .then(function (passport) {
          if (passport) {
            return validatePassword(passport, password, function (err, res) {
              if (err || !res) {
                return next(
                  new Error(
                    `Wrong password entered by ${email}, denying access to API ${
                      err ? err : ''
                    }`
                  ),
                  false
                )
              } else {
                return next(null, user)
              }
            })
          } else {
            return next(
              new Error(`Password not set for ${email}, denying access to API`),
              false
            )
          }
        })
        .catch(next)
    })
    .catch(next)
}
