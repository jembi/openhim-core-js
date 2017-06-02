// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import auth from 'basic-auth';
import { Channel } from '../model/channels';
import logger from 'winston';
import { Transaction } from '../model/transactions';
import Q from 'q';

import config from '../config/config';
let statsdServer = config.get('statsd');
let application = config.get('application');
const SDC = require('statsd-client');
let os = require('os');

let domain = `${os.hostname()}.${application.name}.appMetrics`;
let sdc = new SDC(statsdServer);

export function authoriseUser(ctx, done) {
  // Use the original transaction's channel to setup the authorised channel
  return Transaction.findOne({_id: ctx.parentID}, (err, originalTransaction) =>
    Channel.findOne({_id: originalTransaction.channelID}, function(err, authorisedChannel) {
      ctx.authorisedChannel = authorisedChannel;
      return done();
    })
  );
}
  

/*
 * Koa middleware for authentication by basic auth
 */
export function koaMiddleware(next) {
  let startTime;
  if (statsdServer.enabled) { startTime = new Date(); }
  let authoriseUser = Q.denodeify(exports.authoriseUser);
  ({}); //TODO:Fix yield authoriseUser this
  if (statsdServer.enabled) { sdc.timing(`${domain}.rerunBypassAuthorisationMiddleware`, startTime); }
  return {}; //TODO:Fix yield next
}
