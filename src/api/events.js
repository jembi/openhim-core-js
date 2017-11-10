import { EventModelAPI } from '../model/events'
import * as authorisation from './authorisation'
import * as utils from '../utils'

export async function getLatestEvents (ctx, receivedTime) {
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to events denied.`, 'info')
    return
  }

  try {
    const rtDate = new Date(Number(receivedTime))
    const results = await EventModelAPI.find({created: {$gte: rtDate}}).sort({normalizedTimestamp: 1})
    ctx.body = {events: results}
  } catch (err) {
    utils.logAndSetResponse(ctx, 500, `Could not fetch the latest events via the API: ${err}`, 'error')
  }
}
