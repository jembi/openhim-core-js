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
    sdc.increment domain + '.Channels' # Overall Counter
    sdc.increment domain + '.Channels.' + transactionStatus #Overall Transaction Status
    sdc.increment domain + '.Channels.' + ctx.authorisedChannel._id # Per channel
    sdc.increment domain + '.Channels.' + ctx.authorisedChannel._id + '.Statuses.' + transactionStatus # Per Channel Status

    #Collect stats for non-primary routes
    if ctx.routes?
      for route in ctx.routes
        sdc.increment domain + '.Channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name # Per non-primary route
        sdc.increment domain + '.Channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.StatusCodes' + route.response.status # Per route response status

  catch error
    logger.error error, done


exports.measureTransactionDuration = (ctx, done) ->
  logger.info 'sending durations to statsd for ' + domain + '.' + ctx.authorisedChannel._id
  transactionStatus = ctx.transactionStatus
  try
    sdc.timing domain + '.Channels'  , timer # Overall Timer
    sdc.timing domain + '.Channels.' + transactionStatus, timer # Overall Transaction Status
    sdc.timing domain + '.Channels.' + ctx.authorisedChannel._id, timer # Per Channel
    sdc.timing domain + '.Channels.' + ctx.authorisedChannel._id + '.Statuses.' + transactionStatus, timer # Per Channel Status

    #Collect stats for non-primary routes
    if ctx.routes?
      for route in ctx.routes
        sdc.timing domain + '.Channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name, timer # Per Channel
        sdc.timing domain + '.Channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.StatusCodes' + route.response.status, timer # Per Channel

  catch error
    logger.error error, done

exports.koaMiddleware = `function *statsMiddleware(next) {
    timer = new Date();
    yield next;
    exports.incrementTransactionCount(this)
    exports.measureTransactionDuration(this)
    sdc.close();
}`
