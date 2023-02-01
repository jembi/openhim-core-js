import _ from 'lodash'

import {UserModelAPI, PassportModelAPI} from '../model'

/**
 * OpenID Authentication Protocol
 *
 * OpenID is an open standard for federated authentication.
 *
 * For more information on OpenID in Passport.js, check out:
 * http://www.passportjs.org/packages/passport-openidconnect/
 *
 */

export const login = (
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

  let user = {}

  if (profile.emails && profile.emails[0]) {
    user.email = profile.emails[0].value
  }
  // If the profile object contains a username, add it to the user.
  if (_.has(profile, 'username')) {
    user.username = profile.username
    user.firstname = profile.username
    user.surname  = profile.username
  }
  if (_.has(profile, 'name')) {
    user.firstname = profile.name.givenName || user.firstname
    user.surname = profile.name.familyName || user.surname
  }

  // If neither an email or a username was available in the profile, we don't
  // have a way of identifying the user in the future. Throw an error and let
  // whoever's next in the line take care of it.
  if (!user.username && !user.email) {
    return next(new Error('Neither a username nor email was available'))
  }

  PassportModelAPI.findOne({
    provider: 'keycloak',
    identifier: user.email || user.username,
    protocol: 'openid'
  })
    .then(function (passport) {
      if (!req.user) {
        // Scenario: A new user is attempting to sign up using a third-party
        //           authentication provider.
        // Action:   Create a new user and assign them a passport.
        if (!passport) {
          return UserModelAPI.create({...user, groups: ['admin']}).then(function (_user) {
            user = _user
            return PassportModelAPI.create({
              user: user.id,
              accessToken,
              tokens: tokens,
              provider: 'keycloak',
              identifier: user.email || user.username,
              protocol: 'openid'
            })
              .then(function (passport) {
                next(null, user)
              })
              .catch(next)
          })
        }
        // Scenario: An existing user is trying to log in using an already
        //           connected passport.
        // Action:   Get the user associated with the passport.
        else {
          // If the tokens have changed since the last session, update them
          if (tokens != passport.tokens) {
            passport.tokens = tokens
          }

          // Save any updates to the Passport before moving on
          return PassportModelAPI.findByIdAndUpdate(passport._id, passport)
            .then(function () {
              // Fetch the user associated with the Passport
              return UserModelAPI.findOne(passport.user)
            })
            .then(function (user) {
              next(null, user)
            })
            .catch(next)
        }
      } else {
        // Scenario: A user is currently logged in and trying to connect a new
        //           passport.
        // Action:   Create and assign a new passport to the user.
        if (!passport) {
          return PassportModelAPI.create({
            user: req.user.id,
            accessToken,
            tokens: tokens,
            provider: 'keycloak',
            identifier: user.email || user.username,
            protocol: 'openid',
            firstname: user.username || user.email,
            surname: user.username || user.email
          })
            .then(function (passport) {
              next(null, req.user)
            })
            .catch(next)
        }
        // Scenario: The user is a nutjob or spammed the back-button.
        // Action:   Simply pass along the already established session.
        else {
          next(null, req.user)
        }
      }
    })
    .catch(next)
}
