// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
let setupProxyHeaders;
import logger from "winston";
import Q from "q";

import config from '../config/config';
let statsdServer = config.get('statsd');
let application = config.get('application');
const SDC = require('statsd-client');
let os = require('os');

let domain = `${os.hostname()}.${application.name}.appMetrics`;
let sdc = new SDC(statsdServer);

let setupProxyHeaders$1 = (setupProxyHeaders = function(ctx) {
  // Headers
   function setOrAppendHeader(ctx, header, value) {
    if (!value) { return; }
    if (ctx.header[header]) {
      return ctx.header[header] = `${ctx.header[header]}, ${value}`;
    } else {
      return ctx.header[header] = `${value}`;
    }
  };
  setOrAppendHeader(ctx, 'X-Forwarded-For', ctx.request.ip);
  return setOrAppendHeader(ctx, 'X-Forwarded-Host', ctx.request.host);
});

export { setupProxyHeaders$1 as setupProxyHeaders };
export function koaMiddleware(next) {
  let startTime;
  if (statsdServer.enabled) { startTime = new Date(); }
  exports.setupProxyHeaders(this);
  if (statsdServer.enabled) { sdc.timing(`${domain}.proxyHeadersMiddleware`, startTime); }
  return {}; //TODO:Fix yield next
}
