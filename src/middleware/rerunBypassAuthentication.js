// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import auth from 'basic-auth';
import Q from "q";
import { Client } from "../model/clients";
import logger from "winston";
import crypto from "crypto";

import config from '../config/config';
let statsdServer = config.get('statsd');
let application = config.get('application');
const SDC = require('statsd-client');
let os = require('os');

let domain = `${os.hostname()}.${application.name}.appMetrics`;
let sdc = new SDC(statsdServer);

export function authenticateUser(ctx, done) {

  return Client.findOne({ _id: ctx.request.header.clientid }, function(err, client) {
    ctx.authenticated = client;
    ctx.parentID = ctx.request.header.parentid;
    ctx.taskID = ctx.request.header.taskid;
    return done(null, client);
  });
}
  

/*
 * Koa middleware for authentication by basic auth
 */
export function koaMiddleware(next) {
  let startTime;
  if (statsdServer.enabled) { startTime = new Date(); }
  let authenticateUser = Q.denodeify(exports.authenticateUser);
  ({}); //TODO:Fix yield authenticateUser this

  if (this.authenticated != null) {
    if (statsdServer.enabled) { sdc.timing(`${domain}.rerunBypassAuthenticationMiddleware`, startTime); }
    return {}; //TODO:Fix yield next
  } else {
    this.authenticated =
      {ip : '127.0.0.1'};
    // This is a public channel, allow rerun
    if (statsdServer.enabled) { sdc.timing(`${domain}.rerunBypassAuthenticationMiddleware`, startTime); }
    return {}; //TODO:Fix yield next
  }
}

