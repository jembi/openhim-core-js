'use strict'

import {Schema} from 'mongoose'

import {connectionAPI, connectionDefault} from '../config'

/**
 * Passport Model
 *
 * The Passport model handles associating authenticators with users. An authen-
 * ticator can be either local (password) or third-party (provider). A single
 * user can have multiple passports, allowing them to connect and use several
 * third-party strategies in optional conjunction with a password.
 *
 * Since an application will only need to authenticate a user once per session,
 * it makes sense to encapsulate the data specific to the authentication process
 * in a model of its own. This allows us to keep the session itself as light-
 * weight as possible as the application only needs to serialize and deserialize
 * the user, but not the authentication data, to and from the session.
 */

const PassportSchema = new Schema({
  // Required field: Protocol
  //
  // Defines the protocol to use for the passport. When employing the local
  // strategy, the protocol will be set to 'local'. When using a third-party
  // strategy, the protocol will be set to the standard used by the third-
  // party service.
  // e.g. 'basic', 'openid', 'local', 'token' [token is deprecated]
  protocol: {
    type: String,
    required: true
  },
  // Local field: Password
  //
  // When the local strategy is employed, a password will be used as the
  // means of authentication along with an email.
  password: String,
  // accessToken is used to authenticate API requests. it is generated when a
  // passport (with protocol 'local') is created for a user.
  accessToken: String,

  // Provider fields: Provider, identifer and tokens
  //
  // "issuer" is the url of the third-party auth service used to define the baseUrl
  // in any OIDC endpoint whereas "identifier" is a provider-specific
  // key, typically an ID. These two fields are used as the main means of
  // identifying a passport and tying it to a local user.
  //
  // The "tokens" field is a JSON object used in the case of the OAuth stan-
  // dards. When using OAuth 1.0, a `token` as well as a `tokenSecret` will
  // be issued by the provider. In the case of OAuth 2.0, an `accessToken`
  // and a `refreshToken` will be issued.
  issuer: String,
  identifier: String,
  tokens: Object,

  /*  ----  @deprecated  ---- */
  // Password fields: passwordAlgorithm, passwordHash and passwordSalt
  //
  // Used for the token strategy
  // The "passwordAlgorithm" is used to identify which algorithm was used when hashing the password
  // (e.g 'sha256') "passwordSalt" the random string used for hashing as well and "passwordHash" is the result.
  passwordAlgorithm: String,
  passwordHash: String,
  passwordSalt: String,
  /*  ---- ------------- ---- */

  // Associations
  //
  // Associate every passport with a user.
  email: {
    type: String,
    required: true
  }
})

// compile the Passport Schema into a Model
export const PassportModelAPI = connectionAPI.model('Passport', PassportSchema)
export const PassportModel = connectionDefault.model('Passport', PassportSchema)

/**
 * Register a passport
 *
 * This method creates a new passport from a specified email, username and password
 * and assign it to a newly created user.
 *
 * @param {*} user user that will be linked to the new passport
 * @param {*} passwordInfo either password or password fields (deprecated) which are
 * passwordHash, passwordSalt and passwordAlgorithm
 */
export const createPassport = async function (user, passwordInfo) {
  let result = {error: null, user: null}
  return await PassportModelAPI.create({
    protocol: passwordInfo.password ? 'local' : 'token',
    email: user.email,
    ...passwordInfo
  })
    .then(async function () {
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
export const updatePassport = async function (user, passport) {
  let result = {error: null, user: null}
  return PassportModelAPI.findByIdAndUpdate(passport.id, passport)
    .then(function () {
      result.user = user
      return result
    })
    .catch(err => {
      result.error = err
      return result
    })
}
