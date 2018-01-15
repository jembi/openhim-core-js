import SDC from 'statsd-client'
import os from 'os'
import { ClientModel } from '../model/clients'
import { config } from '../config'
import { promisify } from 'util'

const statsdServer = config.get('statsd')
const application = config.get('application')

const domain = `${os.hostname()}.${application.name}.appMetrics`
const sdc = new SDC(statsdServer)

export function authenticateUser (ctx, done) {
  return ClientModel.findOne({_id: ctx.request.header.clientid}, (err, client) => {
    if (err) { return done(err) }
    ctx.authenticated = client
    ctx.parentID = ctx.request.header.parentid
    ctx.taskID = ctx.request.header.taskid
    return done(null, client)
  })
}

/*
 * Koa middleware for authentication by basic auth
 */
export async function koaMiddleware (ctx, next) {
  let startTime
  if (statsdServer.enabled) { startTime = new Date() }
  const _authenticateUser = promisify(authenticateUser)
  await _authenticateUser(ctx)

  if (ctx.authenticated != null) {
    if (statsdServer.enabled) { sdc.timing(`${domain}.rerunBypassAuthenticationMiddleware`, startTime) }
    await next()
  } else {
    ctx.authenticated = {ip: '127.0.0.1'}
    // This is a public channel, allow rerun
    if (statsdServer.enabled) { sdc.timing(`${domain}.rerunBypassAuthenticationMiddleware`, startTime) }
    await next()
  }
}
