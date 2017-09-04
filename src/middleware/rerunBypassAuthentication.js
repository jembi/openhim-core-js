import Q from 'q'
import SDC from 'statsd-client'
import os from 'os'
import { ClientModel } from '../model/clients'
import { config } from '../config'

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
export function * koaMiddleware (next) {
  let startTime
  if (statsdServer.enabled) { startTime = new Date() }
  const _authenticateUser = Q.denodeify(authenticateUser)
  yield _authenticateUser(this)

  if (this.authenticated != null) {
    if (statsdServer.enabled) { sdc.timing(`${domain}.rerunBypassAuthenticationMiddleware`, startTime) }
    return yield next
  } else {
    this.authenticated =
      {ip: '127.0.0.1'}
    // This is a public channel, allow rerun
    if (statsdServer.enabled) { sdc.timing(`${domain}.rerunBypassAuthenticationMiddleware`, startTime) }
    return yield next
  }
}
