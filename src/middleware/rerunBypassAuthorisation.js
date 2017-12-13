import SDC from 'statsd-client'
import os from 'os'
import { ChannelModel } from '../model/channels'
import { TransactionModel } from '../model/transactions'
import { config } from '../config'
import { promisify } from 'util'

const statsdServer = config.get('statsd')
const application = config.get('application')

const domain = `${os.hostname()}.${application.name}.appMetrics`
const sdc = new SDC(statsdServer)

export function authoriseUser (ctx, done) {
  // Use the original transaction's channel to setup the authorised channel
  TransactionModel.findOne({_id: ctx.parentID}, (err, originalTransaction) => {
    if (err) { return done(err) }
    ChannelModel.findOne({_id: originalTransaction.channelID}, (err, authorisedChannel) => {
      if (err) { return done(err) }
      ctx.authorisedChannel = authorisedChannel
      return done()
    })
  }
  )
}

/*
 * Koa middleware for authentication by basic auth
 */
export async function koaMiddleware (ctx, next) {
  let startTime
  if (statsdServer.enabled) { startTime = new Date() }
  const authoriseUser = promisify(exports.authoriseUser)
  await authoriseUser(ctx)
  if (statsdServer.enabled) { sdc.timing(`${domain}.rerunBypassAuthorisationMiddleware`, startTime) }
  await next()
}
