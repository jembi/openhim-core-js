import SDC from 'statsd-client'
import os from 'os'
import { ClientModel } from '../model/clients'
import { config } from '../config'
import { promisify } from 'util'

const statsdServer = config.get('statsd')
const application = config.get('application')

const domain = `${os.hostname()}.${application.name}.appMetrics`
const sdc = new SDC(statsdServer)

const dummyClient = new ClientModel({
  clientID: 'DUMMY-POLLING-USER',
  clientDomain: 'openhim.org',
  name: 'DUMMY-POLLING-USER',
  roles: ['polling']
})

export function authenticateUser (ctx, done) {
  ctx.authenticated = dummyClient
  return done(null, dummyClient)
}

/*
 * Koa middleware for bypassing authentication for polling requests
 */
export async function koaMiddleware (ctx, next) {
  let startTime
  if (statsdServer.enabled) { startTime = new Date() }
  const _authenticateUser = promisify(authenticateUser)
  await _authenticateUser(ctx)

  if (ctx.authenticated != null) {
    if (statsdServer.enabled) { sdc.timing(`${domain}.pollingBypassAuthenticationMiddleware`, startTime) }
    await next()
  } else {
    ctx.response.status = 401
    if (statsdServer.enabled) { return sdc.timing(`${domain}.pollingBypassAuthenticationMiddleware`, startTime) }
  }
}
