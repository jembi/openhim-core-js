import crypto from 'crypto'
import base64URL from 'base64url'
import logger from 'winston'

import {UserModelAPI} from '../model'
import {hashPassword, validatePassword} from '../api/passport'
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

var EMAIL_REGEX =
  /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))$/i

/**
 * Use validator module isEmail function
 *
 * @see <https://github.com/chriso/validator.js/blob/3.18.0/validator.js#L38>
 * @see <https://github.com/chriso/validator.js/blob/3.18.0/validator.js#L141-L143>
 */
function validateEmail(str) {
  return EMAIL_REGEX.test(str)
}

function generateToken() {
  return base64URL(crypto.randomBytes(48))
}

/**
 * Register a passport
 *
 * This method creates a new passport from a specified email, username and password
 * and assign it to a newly created user.
 *
 */
const createPassport = async function (user, password, accessToken) {
  let result = {error: null, user: null}
  return await PassportModelAPI.create({
    protocol: 'local',
    password: password,
    user: user.id,
    accessToken: accessToken
  })
    .then(async function (passport) {
      result.user = user
      return result
    })
    .catch(err => {
      result.error = err
      return result
    })
}

/**
 * Update a passport
 *
 * This method updates a passport of a specific user
 *
 */
const updatePassport = async function (user, passport) {
  let result = {error: null, user: null}
  return PassportModelAPI.updateOne(passport)
    .then(function (passport) {
      result.user = user
      return result
    })
    .catch(err => {
      result.error = err
      return result
    })
}

/**
 * Register a new user
 *
 * This method creates a new user from a specified email, username and password
 * and assign the newly created user a local Passport.
 *
 */
export const createUser = async function (_user) {
  let result = {error: null, user: null}
  try {
    var accessToken = generateToken()
    var password = await hashPassword(_user.password)
    delete _user.password

    return await UserModelAPI.create(_user)
      .then(async function (user) {
        return await createPassport(user, password, accessToken)
      })
      .catch(err => {
        result.error = err
        return result
      })
  } catch (err) {
    result.error = err
    return result
  }
}

/**
 * Update user
 *
 * This method updates an user based on its id or username if id is not present
 * and assign the newly created user a local Passport.
 *
 */
export const updateUser = async function (_user) {
  try {
    var accessToken = generateToken()
    var password = await hashPassword(_user.password)

    delete _user.password

    let result = {user: null, error: null}

    await UserModelAPI.findByIdAndUpdate(_user.id, _user, {
      new: true
    })
      .then(async function (user) {
        // Check if password has a string to replace it
        if (!!password) {
          await PassportModelAPI.findOne({
            protocol: 'local',
            user: user.id
          })
            .then(async function (passport) {
              if (passport) {
                passport.password = password
                result = await updatePassport(user, passport)
              } else {
                result = await createPassport(user, password, accessToken)
              }
            })
            .catch(err => {
              result.error = err
            })
        } else {
          result.user = user
        }
      })
      .catch(err => {
        result.error = err
      })

    return result
  } catch (err) {
    result.error = err
    return result
  }
}

/**
 * Validate a login request
 *
 * Looks up a user using the supplied identifier (email or username) and then
 * attempts to find a local Passport associated with the user. If a Passport is
 * found, its password is checked against the password supplied in the form.
 *
 */
export const login = async function (email, password, next) {
  var isEmail = validateEmail(email),
    query = {}

  if (isEmail) {
    query.email = email
  } else {
    logger.error(`Invalid Email ${email}, denying access to API`)
    return next(null, false)
  }

  await UserModelAPI.findOne(query, async function (err, user) {
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
            if (err) {
              logger.error(err)
              return next(null, false)
            }
            if (!res) {
              logger.error(
                `Wrong password entered by ${email}, denying access to API`
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
