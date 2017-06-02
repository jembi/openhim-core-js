import { Event } from '../model/events';
import authorisation from './authorisation';
import utils from "../utils";


export function getLatestEvents(receivedTime) {
  if (!authorisation.inGroup('admin', this.authenticated)) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to events denied.`, 'info');
    return;
  }

  try {
    let rtDate = new Date(Number(receivedTime));
    let results = {}; //TODO:Fix yield Event.find({ 'created': { '$gte': rtDate } }).sort({ 'normalizedTimestamp': 1 }).exec()
    return this.body = {events: results};
  } catch (err) {
    return utils.logAndSetResponse(this, 500, `Could not fetch the latest events via the API: ${err}`, 'error');
  }
}
