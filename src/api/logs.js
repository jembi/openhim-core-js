import logger from 'winston'
import moment from 'moment'
import * as authorisation from './authorisation'
import * as utils from '../utils'
import { promisify } from 'util'

const levels = {
  debug: 1,
  info: 2,
  warn: 3,
  error: 4
}

export async function getLogs (ctx) {
  // Only admins can view server logs
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to getLogs denied.`, 'info')
    return
  }

  let { query } = ctx.request || {}
  if (query == null) {
    query = {}
  }

  // default to info level logs
  if (query.level == null) {
    query.level = 'info'
  }

  const options = {
    from: query.from != null ? moment(query.from).toDate() : moment().subtract(5, 'minutes').toDate(),
    until: moment(query.until || undefined).toDate(),
    order: 'asc',
    start: parseInt(query.start, 10) || 0,
    limit: 100000 // limit: 0 doesn't work :/
  }

  let results = await promisify(logger.query.bind(logger))(options)
  results = results.mongodb

  if (query.level != null) {
    results = results.filter(item => levels[item.level] >= levels[query.level])
  }

  if (query.limit != null) {
    results.splice(query.limit, results.length - query.limit)
  }

  ctx.body = results
  ctx.status = 200
}
