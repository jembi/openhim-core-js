import _ from 'lodash'

import {UserModelAPI, PassportModelAPI} from '../model'
import {config} from '../config'

/**
 * OpenID Authentication Protocol
 *
 * OpenID is an open standard for federated authentication.
 *
 * For more information on OpenID in Passport.js, check out:
 * http://www.passportjs.org/packages/passport-openidconnect/
 *
 */

function parseJwt(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
}

function constructUserInfo(profile, accessToken) {
  let user = {}

  const {clientId} = config.api.openid
  const {sub, resource_access} = parseJwt(accessToken)

  if (resource_access && resource_access[`${clientId}`]) {
    user.groups = resource_access[`${clientId}`].roles
  } else {
    user.groups = []
  }

  if (profile.emails && profile.emails[0]) {
    user.email = profile.emails[0].value
  } else if (profile.username) {
    user.email = profile.username
  }

  user.firstname = _.has(profile, 'name.givenName')
    ? profile.name.givenName
    : profile.username
  user.surname = _.has(profile, 'name.familyName')
    ? profile.name.familyName
    : profile.username

  user.provider = 'openid'

  // In case the user was created before
  user.token = null
  user.tokenType = null
  user.locked = false
  user.expiry = null

  return {user, identifier: sub}
}

function createOrUpdateUser(user) {
  return UserModelAPI.findOne({email: user.email}).then(function (
    retrievedUser
  ) {
    if (retrievedUser) {
      return UserModelAPI.findByIdAndUpdate(retrievedUser.id, user, {
        new: true
      })
    } else {
      return UserModelAPI.create(user)
    }
  })
}

export const login = async (
  req,
  issuer,
  profile,
  accessToken,
  tokens,
  next
) => {
  const {user, identifier} = constructUserInfo(profile, accessToken)

  // If an email was not available in the profile, we don't
  // have a way of identifying the user in the future. Throw an error and let
  // whoever's next in the line take care of it.
  if (!user.email) {
    return next(
      new Error(
        'Trying to login with openid, but email was not provided in the profile'
      ),
      false
    )
  }

  const newPassport = {
    accessToken,
    tokens,
    issuer,
    identifier: identifier,
    protocol: 'openid',
    email: user.email
  }

  PassportModelAPI.findOne({
    issuer,
    protocol: 'openid',
    identifier: identifier
  })
    .then(function (passport) {
      if (!req.user) {
        // Scenario: A (new) user is attempting to sign up using a third-party
        //           authentication provider.
        // Action:   Create/update the user and assign them a passport.
        if (!passport) {
          return createOrUpdateUser(user)
            .then(function (retrievedUser) {
              return PassportModelAPI.create(
                newPassport,
                function () {
                  next(null, retrievedUser)
                }
              )
            })
            .catch(next)
        }
        // Scenario: An existing user is trying to log in using an already
        //           connected passport.
        // Action:   Get the user associated with the passport and update its info.
        else {
          // If the tokens have changed since the last session, update them
          if (!_.isEqual(tokens, passport.tokens)) {
            passport.tokens = tokens
          }
          if (accessToken != passport.accessToken) {
            passport.accessToken = accessToken
          }

          // Save any updates to the Passport before moving on
          return PassportModelAPI.findByIdAndUpdate(passport.id, passport)
            .then(function () {
              // Fetch the user associated with the Passport and update it
              return createOrUpdateUser(user)
            })
            .then(function (retrievedUser) {
              next(null, retrievedUser)
            })
            .catch(next)
        }
      } else {
        // Scenario: The user is a already logged in or spammed the back-button.
        // Action:   Simply pass along the already established session.
        next(null, req.user)
      }
    })
    .catch(next)
}
