config = require '../config/config'
statsd_client = require "statsd-client"
statsd_server = config.get 'statsd'
application = config.get 'application'
logger = require "winston"
os = require "os"
timer = new Date()
domain = os.hostname() + '.' + application.name

sdc = new statsd_client statsd_server

exports.incrementTransactionCount = (ctx, done) ->
  logger.info 'sending counts to statsd for ' + domain + '.' + ctx.authorisedChannel._id
  transactionStatus = ctx.transactionStatus
  try
    sdc.increment domain # Overall Counter
    sdc.increment domain + '.' + transactionStatus #Overall Transaction Status
    sdc.increment domain + '.' + ctx.authorisedChannel._id # Per channel
    sdc.increment domain + '.' + ctx.authorisedChannel._id + '.' + transactionStatus # Per Channel Status
  catch error
    logger.error error


exports.measureTransactionDuration = (ctx, done) ->
  logger.info 'sending durations to statsd for ' + domain + '.' + ctx.authorisedChannel._id
  transactionStatus = ctx.transactionStatus
  try
    sdc.timing domain , timer # Overall Timer
    sdc.timing domain + '.' + transactionStatus, timer # Overall Transaction Status
    sdc.timing domain + '.' + ctx.authorisedChannel._id, timer # Per Channel
    sdc.timing domain + '.' + ctx.authorisedChannel._id + '.' + transactionStatus, timer #Per Channel Status
  catch error
    logger.error error

exports.koaMiddleware = `function *statsMiddleware(next) {

      yield next;
      exports.incrementTransactionCount(this)
      exports.measureTransactionDuration(this)
      sdc.close();
}`