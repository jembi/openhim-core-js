// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import Q from "q";
import { Client } from "../model/clients";
import logger from "winston";

import config from '../config/config';
let statsdServer = config.get('statsd');
let application = config.get('application');
const SDC = require('statsd-client');
let os = require('os');

let domain = `${os.hostname()}.${application.name}.appMetrics`;
let sdc = new SDC(statsdServer);

let dummyClient = new Client({
  clientID: 'DUMMY-POLLING-USER',
  clientDomain: 'openhim.org',
  name: 'DUMMY-POLLING-USER',
  roles: ['polling']});

export function authenticateUser(ctx, done) {
  ctx.authenticated = dummyClient;
  return done(null, dummyClient);
}
  

/*
 * Koa middleware for bypassing authentication for polling requests
 */
export function koaMiddleware(next) {
  let startTime;
  if (statsdServer.enabled) { startTime = new Date(); }
  let authenticateUser = Q.denodeify(exports.authenticateUser);
  ({}); //TODO:Fix yield authenticateUser this

  if (this.authenticated != null) {
    if (statsdServer.enabled) { sdc.timing(`${domain}.pollingBypassAuthenticationMiddleware`, startTime); }
    return {}; //TODO:Fix yield next
  } else {
    this.response.status = 401;
    if (statsdServer.enabled) { return sdc.timing(`${domain}.pollingBypassAuthenticationMiddleware`, startTime); }
  }
}