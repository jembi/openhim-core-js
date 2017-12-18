import SDC from 'statsd-client'
import os from 'os'
import { ChannelModel } from '../model/channels'
import { config } from '../config'
import { promisify } from 'util'

const statsdServer = config.get('statsd')
const application = config.get('application')

const domain = `${os.hostname()}.${application.name}.appMetrics`
const sdc = new SDC(statsdServer)

export function authoriseUser (ctx, done) {
  return ChannelModel.findOne({_id: ctx.request.header['channel-id']}, (err, channel) => {
    if (err) { return done(err) }
    ctx.authorisedChannel = channel
    return done(null, channel)
  })
}

/*
 * Koa middleware for bypassing authorisation for polling
 */
export async function koaMiddleware (ctx, next) {
  let startTime
  if (statsdServer.enabled) { startTime = new Date() }
  const _authoriseUser = promisify(authoriseUser)
  await _authoriseUser(ctx)
  if (statsdServer.enabled) { sdc.timing(`${domain}.pollingBypassAuthorisationMiddleware`, startTime) }
  await next()
}
