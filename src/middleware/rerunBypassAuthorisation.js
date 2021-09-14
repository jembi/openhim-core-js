'use strict'

import {promisify} from 'util'

import {ChannelModel} from '../model/channels'
import {TransactionModel} from '../model/transactions'

export function authoriseUser(ctx, done) {
  // Use the original transaction's channel to setup the authorised channel
  TransactionModel.findOne({_id: ctx.parentID}, (err, originalTransaction) => {
    if (err) {
      return done(err)
    }
    ChannelModel.findOne(
      {_id: originalTransaction.channelID},
      (err, authorisedChannel) => {
        if (err) {
          return done(err)
        }
        ctx.authorisedChannel = authorisedChannel
        return done()
      }
    )
  })
}

/*
 * Koa middleware for authentication by basic auth
 */
export async function koaMiddleware(ctx, next) {
  const authoriseUser = promisify(exports.authoriseUser)
  await authoriseUser(ctx)
  await next()
}
