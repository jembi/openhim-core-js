import logger from 'winston'
import * as utils from '../utils'
import { version as currentCoreVersion } from '../../package.json'

export async function getAboutInformation (ctx) {
  try {
    ctx.body = {currentCoreVersion, serverTimezone: utils.serverTimezone()}
    ctx.status = 200
    logger.info(`User ${ctx.authenticated.email} successfully fetched 'about' information`)
  } catch (e) {
    utils.logAndSetResponse(ctx, 500, `Could not fetch 'about' info via the API ${e}`, 'error')
  }
}
