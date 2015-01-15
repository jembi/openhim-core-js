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
    sdc.increment domain + '.channels' # Overall Counter
    sdc.increment domain + '.channels.' + transactionStatus #Overall Transaction Status
    sdc.increment domain + '.channels.' + ctx.authorisedChannel._id # Per channel
    sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.statuses.' + transactionStatus # Per Channel Status

    #Collect stats for non-primary routes
    if ctx.routes?
      for route in ctx.routes
        sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name # Per non-primary route
        sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.statusCodes.' + route.response.status # Per route response status

        if route.orchestrations?
          for orchestration in route.orchestrations
            orchestrationStatus = orchestration.response.status
            sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.orchestrations.' + orchestration.name
            sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.orchestrations.' + orchestration.name + '.statusCodes.' + orchestrationStatus
            sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.statusCodes.' + route.response.status + '.orchestrations.' + orchestration.name
            sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.statusCodes.' + route.response.status + '.orchestrations.' + orchestration.name + '.statusCodes.' + orchestrationStatus


    if ctx.mediatorResponse?
      if ctx.mediatorResponse.orchestrations?
        for orchestration in ctx.mediatorResponse.orchestrations
          orchestrationStatus = orchestration.response.status
          sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.orchestrations.' + orchestration.name
          sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.orchestrations.' + orchestration.name + '.statusCodes.' + orchestrationStatus
          sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.statuses.' + transactionStatus + '.orchestrations.' + orchestration.name
          sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.statuses.' + transactionStatus + '.orchestrations.' + orchestration.name + '.statusCodes.' + orchestrationStatus

  catch error
    logger.error error, done


exports.measureTransactionDuration = (ctx, done) ->
  logger.info 'sending durations to statsd for ' + domain + '.' + ctx.authorisedChannel._id
  transactionStatus = ctx.transactionStatus
  try
    sdc.timing domain + '.channels'  , timer # Overall Timer
    sdc.timing domain + '.channels.' + transactionStatus, timer # Overall Transaction Status
    sdc.timing domain + '.channels.' + ctx.authorisedChannel._id, timer # Per Channel
    sdc.timing domain + '.channels.' + ctx.authorisedChannel._id + '.statuses.' + transactionStatus, timer # Per Channel Status

    #Collect stats for non-primary routes
    if ctx.routes?
      for route in ctx.routes
        sdc.timing domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name, timer
        sdc.timing domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.statusCodes' + route.response.status, timer

        if route.orchestrations?
          for orchestration in route.orchestrations
            orchestratrionDuration = orchestration.response.timestamp - orchestration.request.timestamp
            orchestrationStatus = orchestration.response.status
            sdc.timing domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.orchestrations.' + orchestration.name, orchestratrionDuration
            sdc.timing domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.orchestrations.' + orchestration.name + '.statusCodes.' + orchestrationStatus , orchestratrionDuration
            sdc.timing domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.statusCodes.' + route.response.status + '.orchestrations.' + orchestration.name, orchestratrionDuration
            sdc.timing domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.statusCodes.' + route.response.status + '.orchestrations.' + orchestration.name + '.statusCodes.' + orchestrationStatus , orchestratrionDuration



    if ctx.mediatorResponse?
      if ctx.mediatorResponse.orchestrations?
        for orchestration in ctx.mediatorResponse.orchestrations
          orchestratrionDuration = orchestration.response.timestamp - orchestration.request.timestamp
          orchestrationStatus = orchestration.response.status
          sdc.timing domain + '.channels.' + ctx.authorisedChannel._id + '.orchestrations.' + orchestration.name, orchestratrionDuration
          sdc.timing domain + '.channels.' + ctx.authorisedChannel._id + '.orchestrations.' + orchestration.name + '.statusCodes.' + orchestrationStatus , orchestratrionDuration


  catch error
    logger.error error, done

exports.koaMiddleware = `function *statsMiddleware(next) {
    timer = new Date();
    yield next;
    exports.incrementTransactionCount(this)
    exports.measureTransactionDuration(this)
    sdc.close();
}`
