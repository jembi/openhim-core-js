import { EventModelAPI } from '../model/events'
import * as authorisation from './authorisation'
import * as utils from '../utils'

export function * getLatestEvents (receivedTime) {
  if (!authorisation.inGroup('admin', this.authenticated)) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to events denied.`, 'info')
    return
  }

  try {
    const rtDate = new Date(Number(receivedTime))
    const results = yield EventModelAPI.find({ created: { $gte: rtDate } }).sort({ normalizedTimestamp: 1 }).exec()
    this.body = { events: results }
  } catch (err) {
    return utils.logAndSetResponse(this, 500, `Could not fetch the latest events via the API: ${err}`, 'error')
  }
}
