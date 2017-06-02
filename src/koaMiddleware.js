import koa from 'koa';
import router from './middleware/router';
import messageStore from './middleware/messageStore';
import basicAuthentication from './middleware/basicAuthentication';
import tlsAuthentication from "./middleware/tlsAuthentication";
import rerunBypassAuthentication from "./middleware/rerunBypassAuthentication";
import rerunBypassAuthorisation from "./middleware/rerunBypassAuthorisation";
import rerunUpdateTransactionTask from "./middleware/rerunUpdateTransactionTask";
import tcpBypassAuthentication from "./middleware/tcpBypassAuthentication";
import retrieveTCPTransaction from "./middleware/retrieveTCPTransaction";
import requestMatching from './middleware/requestMatching';
import authorisation from './middleware/authorisation';
import stats from './stats';
import pollingBypassAuthorisation from './middleware/pollingBypassAuthorisation';
import pollingBypassAuthentication from './middleware/pollingBypassAuthentication';
import events from './middleware/events';
import proxy from './middleware/proxy';
import rewrite from './middleware/rewriteUrls';
import config from './config/config';
config.authentication = config.get('authentication');
let getRawBody = require('raw-body');
let tcpAdapter = require('./tcpAdapter');
const Q = require("q");
config.statsd = config.get('statsd');

let application = config.get('application');
const SDC = require('statsd-client');
let os = require('os');

let domain = `${os.hostname()}.${application.name}.appMetrics`;
let sdc = new SDC(config.statsd);

let compress = require('koa-compress');

let rawBodyReader = function(next) {
  let startTime;
  if (config.statsd.enabled) { startTime = new Date(); }
  /*body =  #TODO:Fix yield getRawBody this.req,
    length: this.length,
    encoding: this.charset*/

  if (body) { this.body = body; }
  if (config.statsd.enabled) { sdc.timing(`${domain}.rawBodyReaderMiddleware`, startTime); }
  return {}; //TODO:Fix yield next
};


// Primary app

export function setupApp(done) {
  let app = koa();

  // Basic authentication middleware
  if (config.authentication.enableBasicAuthentication) {
    app.use(basicAuthentication.koaMiddleware);
  }

  // TLS authentication middleware
  if (config.authentication.enableMutualTLSAuthentication) {
    app.use(tlsAuthentication.koaMiddleware);
  }

  app.use(rawBodyReader);

  // Request Matching middleware
  app.use(requestMatching.koaMiddleware);

  // Authorisation middleware
  app.use(authorisation.koaMiddleware);

  // Compress response on exit
  app.use(compress({
    threshold: 8,
    flush: require("zlib").Z_SYNC_FLUSH
  })
  );

  // Proxy
  app.use(proxy.koaMiddleware);

  // Persist message middleware
  app.use(messageStore.koaMiddleware);

  // URL rewriting middleware
  app.use(rewrite.koaMiddleware);

  // Events
  app.use(events.koaMiddleware);

  // Call router
  app.use(router.koaMiddleware);

  return done(app);
}


// Rerun app that bypasses auth
export function rerunApp(done) {
  let app = koa();

  app.use(rawBodyReader);

  // Rerun bypass authentication middlware
  app.use(rerunBypassAuthentication.koaMiddleware);

  // Rerun bypass authorisation middlware
  app.use(rerunBypassAuthorisation.koaMiddleware);

  // Update original transaction with rerunned transaction ID
  app.use(rerunUpdateTransactionTask.koaMiddleware);

  // Persist message middleware
  app.use(messageStore.koaMiddleware);

  // Authorisation middleware
  app.use(authorisation.koaMiddleware);

  // Events
  app.use(events.koaMiddleware);

  // Call router
  app.use(router.koaMiddleware);

  return done(app);
}

// App for TCP/TLS sockets
export function tcpApp(done) {
  let app = koa();

  app.use(rawBodyReader);
  app.use(retrieveTCPTransaction.koaMiddleware);

  // TCP bypass authentication middlware
  app.use(tcpBypassAuthentication.koaMiddleware);

  // Proxy
  app.use(proxy.koaMiddleware);

  // Persist message middleware
  app.use(messageStore.koaMiddleware);

  // Events
  app.use(events.koaMiddleware);

  // Call router
  app.use(router.koaMiddleware);

  return done(app);
}

// App used by scheduled polling
export function pollingApp(done) {
  let app = koa();

  app.use(rawBodyReader);

  // Polling bypass authentication middlware
  app.use(pollingBypassAuthentication.koaMiddleware);

  // Polling bypass authorisation middleware
  app.use(pollingBypassAuthorisation.koaMiddleware);

  // Persist message middleware
  app.use(messageStore.koaMiddleware);

  // Events
  app.use(events.koaMiddleware);

  // Call router
  app.use(router.koaMiddleware);

  return done(app);
}
