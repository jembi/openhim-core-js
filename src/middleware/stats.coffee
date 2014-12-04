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
  try
    sdc.increment domain + '.' + ctx.authorisedChannel._id
  catch error
    logger.error error


exports.measureTransactionDuration = (ctx, done) ->
  logger.info 'sending durations to statsd for ' + domain + '.' + ctx.authorisedChannel._id
  try
    sdc.timing domain + '.' + ctx.authorisedChannel._id, timer
  catch error
    logger.error error

exports.incrementTransactionStatusCount = (ctx, done) ->
  logger.info 'sending status count to statsd for ' + domain + '.' + ctx.authorisedChannel._id
  transactionStatus = ctx.transactionStatus
  try
    sdc.increment domain + '.' + ctx.authorisedChannel._id + '.' + transactionStatus
  catch error
    logger.error error


exports.koaMiddleware = `function *statsMiddleware(next) {

      yield next;
      console.log('In stats middleware');
      exports.incrementTransactionCount(this)
      exports.incrementTransactionStatusCount(this)
      exports.measureTransactionDuration(this)
      sdc.close();
}`