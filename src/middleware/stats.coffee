config = require '../config/config'
statsd_client = require "statsd-client"
statsd_server = config.get 'statsd'
application = config.get 'application'
sdc = new statsd_client statsd_server
timer = new Date()
logger = require "winston"
os = require "os"
domain = os.hostname() + '.' + application.name


exports.incrementTransactionCount = (ctx, done) ->
  logger.info 'sending count to statsd for ' + domain + '.' + ctx.authorisedChannel._id
  sdc.increment application.name + '.' + ctx.authorisedChannel._id


exports.measureTransactionDuration = (ctx, done) ->
  logger.info 'sending durations to statsd for ' + domain + '.' + ctx.authorisedChannel._id
  sdc.timing application.name + '.' + ctx.authorisedChannel._id, timer

exports.koaMiddleware = `function *statsMiddleware(next) {

      yield next;
      exports.incrementTransactionCount(this)
      exports.measureTransactionDuration(this)
      sdc.close();
}`