import crypto from 'crypto'

import {PassportModelAPI} from '../model/passport'
import {UserModelAPI} from '../model'
import {config} from '../config'
import {caseInsensitiveRegex} from '../utils'

/**
 * Token Authentication: A passport strategy for authenticating with custom logic
 *
 * For more information on custom authentication in Passport.js, check out:
 * https://www.passportjs.org/packages/passport-custom/
 */

const isUndefOrEmpty = string => string == null || string === ''

/**
 * @deprecated
 * Validate a login request
 *
 * Looks up a user using the supplied header info and then
 * attempts to find a token Passport associated with the user. If a Passport is
 * found, its passwordHash is checked against the token supplied in the header.
 *
 */
export const login = async function (req, next) {
  try {
    const {header} = req
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
      return next(
        new Error(
          `API request made by ${email} from ${req.host} is missing required API authentication headers, denying access`
        ),
        false
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
      return next(
        new Error(
          `API request made by ${email} from ${req.host} has expired, denying access`
        ),
        false
      )
    }

    const user = await UserModelAPI.findOne({
      email: caseInsensitiveRegex(email)
    })

    if (user == null) {
      // not authenticated - user not found
      return next(
        new Error(
          `No user exists for ${email}, denying access to API, request originated from ${req.host}`
        ),
        false
      )
    }

    const passport = await PassportModelAPI.findOne({
      protocol: 'token',
      email: user.email
    })

    if (passport == null) {
      // not authenticated - user not found
      return next(
        new Error(
          `Password not set for ${email}, denying access to API, request originated from ${req.host}`
        ),
        false
      )
    }

    const hash = crypto.createHash(passport.passwordAlgorithm)
    hash.update(passport.passwordHash)
    hash.update(authSalt)
    hash.update(authTS)

    if (authToken !== hash.digest('hex')) {
      // not authenticated - token mismatch
      return next(
        new Error(
          `API token did not match expected value, denying access to API, the request was made by ${email} from ${req.host}`
        ),
        false
      )
    }
    return next(null, user)
  } catch (err) {
    return next(err, false)
  }
}
