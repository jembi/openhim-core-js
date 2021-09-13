'use strict'

import moment from 'moment'
import {promisify} from 'util'

import * as server from '../server'
import * as utils from '../utils'
import {MediatorModelAPI} from '../model/mediators'

export async function getHeartbeat(ctx) {
  try {
    const uptime = promisify(server.getUptime)
    const result = await uptime()

    const mediators = await MediatorModelAPI.find().exec()
    for (const mediator of Array.from(mediators)) {
      if (!result.mediators) {
        result.mediators = {}
      }

      if (
        mediator._lastHeartbeat != null &&
        mediator._uptime != null &&
        // have we received a heartbeat within the last minute?
        moment().diff(mediator._lastHeartbeat, 'seconds') <= 60
      ) {
        result.mediators[mediator.urn] = mediator._uptime
      } else {
        result.mediators[mediator.urn] = null
      }
    }

    result.now = Date.now()
    ctx.body = result
  } catch (e) {
    return utils.logAndSetResponse(ctx, 500, `Error: ${e}`, 'error')
  }
}
