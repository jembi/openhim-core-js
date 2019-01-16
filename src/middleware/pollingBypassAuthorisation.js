import { ChannelModel } from '../model/channels'
import { config } from '../config'
import { promisify } from 'util'

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
  const _authoriseUser = promisify(authoriseUser)
  await _authoriseUser(ctx)
  await next()
}
