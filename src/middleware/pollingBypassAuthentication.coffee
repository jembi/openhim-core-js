Q = require "q"
Client = require("../model/clients").Client
logger = require "winston"

dummyClient = new Client
  clientID: 'DUMMY-POLLING-USER'
  clientDomain: 'openhim.org'
  name: 'DUMMY-POLLING-USER'
  roles: ['polling']

exports.authenticateUser = (ctx, done) ->
  ctx.authenticated = dummyClient
  done null, dummyClient
  

###
# Koa middleware for bypassing authentication for polling requests
###
exports.koaMiddleware = `function *pollingBypassAuthMiddleware(next) {
  
  var authenticateUser = Q.denodeify(exports.authenticateUser);
  yield authenticateUser(this);

  if (this.authenticated) {
    yield next;
  } else {
    this.response.status = "unauthorized";
  }
  
}`
