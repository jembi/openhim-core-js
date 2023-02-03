import * as local from './local'

/**
 * Basic Authentication Protocol
 *
 * the application sends a username and password with every request
 *
 * For more information on basic authentication in Passport.js, check out:
 * https://www.passportjs.org/packages/passport-http/
 */

export const login = async function (username, password, next) {
  return await local.login(username, password, next)
}
