'use strict'

import * as authorisation from './authorisation'
import * as utils from '../utils'
import {EventModelAPI} from '../model/events'

export async function getLatestEvents(ctx, receivedTime) {
  const authorised = await utils.checkUserPermission(ctx, 'getEvents', 'events-view-all')

  if (!authorised) return

  try {
    const rtDate = new Date(Number(receivedTime))
    const results = await EventModelAPI.find({
      created: {$gte: rtDate}
    }).sort({normalizedTimestamp: 1})
    ctx.body = {events: results}
  } catch (err) {
    utils.logAndSetResponse(
      ctx,
      500,
      `Could not fetch the latest events via the API: ${err}`,
      'error'
    )
  }
}
