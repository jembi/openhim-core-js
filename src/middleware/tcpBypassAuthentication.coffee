Q = require "q"
Client = require("../model/clients").Client
logger = require "winston"

dummyClient = new Client
  clientID: 'DUMMY-TCP-USER'
  clientDomain: 'openhim.org'
  name: 'DUMMY-TCP-USER'
  roles: ['tcp']

exports.authenticateUser = (ctx, done) ->
  ctx.authenticated = dummyClient
  done null, dummyClient
  

###
# Koa middleware for bypassing authentication for tcp requests
###
exports.koaMiddleware = `function *tcpBypassAuthMiddleware(next) {
  
  var authenticateUser = Q.denodeify(exports.authenticateUser);
  yield authenticateUser(this);

  if (this.authenticated) {
    yield next;
  } else {
    this.response.status = "unauthorized";
  }
  
}`
