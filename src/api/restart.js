import logger from 'winston'
import * as authorisation from '../api/authorisation'
import * as server from '../server'
import { config } from '../config'
import * as KeystoreAPI from '../api/keystore'
import * as utils from '../utils'
import { promisify } from 'util'

config.router = config.get('router')
config.api = config.get('api')
config.rerun = config.get('rerun')
config.polling = config.get('polling')
config.tcpAdapter = config.get('tcpAdapter')

/*
 * restart the server
 */
export async function restart (ctx, next) {
  // Test if the user is authorised
  if (authorisation.inGroup('admin', ctx.authenticated) === false) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to restart the server denied.`, 'info')
    return
  }

  try {
    const emailAddr = ctx.authenticated.email

    const result = await promisify(KeystoreAPI.getCertKeyStatus)()

    // valid certificate/key
    if (result) {
      server.startRestartServerTimeout(() => logger.info(`User ${emailAddr} has requested a Server Restart. Proceeding to restart servers...`))

      // All ok! So set the result
      ctx.body = 'Server being restarted'
      ctx.status = 200
    } else {
      // Not valid
      logger.info(`User ${emailAddr} has requested a Server Restart with invalid certificate details. Cancelling restart...`)
      ctx.body = 'Certificates and Key did not match. Cancelling restart...'
      ctx.status = 400
    }
  } catch (e) {
    utils.logAndSetResponse(ctx, 400, `Could not restart the servers via the API: ${e}`, 'error')
  }
}
