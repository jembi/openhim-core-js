config = require '../config/config'
statsd_client = require "statsd-client"
statsd_server = config.get 'statsd'
application = config.get 'application'
logger = require "winston"
os = require "os"
timer = new Date()
domain = os.hostname() + '.' + application.name
util = require "util"

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

        if route.metrics?
          for metric in route.metrics
            if metric.type == 'counter'
              logger.info 'incrementing mediator counter ' + metric.name
              sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.mediator_metrics.' + metric.name

            if metric.type == 'timer'
              logger.info 'incrementing mediator timer ' + metric.name
              sdc.timing domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.mediator_metrics.' + metric.name, metric.value

            if metric.type == 'gauge'
              logger.info 'incrementing mediator gauge ' + metric.name
              sdc.gauge domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.mediator_metrics.' + metric.name, metric.value

        if route.orchestrations?
          for orchestration in route.orchestrations
            orchestrationStatus = orchestration.response.status
            sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.orchestrations.' + orchestration.name
            sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.orchestrations.' + orchestration.name + '.statusCodes.' + orchestrationStatus
            sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.statusCodes.' + route.response.status + '.orchestrations.' + orchestration.name
            sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.statusCodes.' + route.response.status + '.orchestrations.' + orchestration.name + '.statusCodes.' + orchestrationStatus

#           Log custom orchestration metrics
            if orchestration.metrics?
              for metric in orchestration.metrics
                if metric.type == 'counter'
                  logger.info 'incrementing '+ route.name + ' orchestration counter ' + metric.name
                  sdc.increment   domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.orchestrations.' + orchestration.name + '.' + metric.name, metric.value

                if metric.type == 'timer'
                  logger.info 'incrementing '+ route.name + 'orchestration timer ' + metric.name
                  sdc.timing      domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.orchestrations.' + orchestration.name + '.' + metric.name, metric.value

                if metric.type == 'gauge'
                  logger.info 'incrementing '+ route.name + 'orchestration gauge ' + metric.name
                  sdc.gauge       domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.orchestrations.' + orchestration.name  + '.' + metric.name, metric.value


    if ctx.mediatorResponse?
#      Check for custom mediator metrics
      if ctx.mediatorResponse.metrics?

        for metric in ctx.mediatorResponse.metrics

          if metric.type == 'counter'
            logger.info 'incrementing mediator counter ' + metric.name
            sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.' + ctx.mediatorResponse.properties.name + '.mediator_metrics.' + metric.name

          if metric.type == 'timer'
            logger.info 'incrementing mediator timer ' + metric.name
            sdc.timing domain + '.channels.' + ctx.authorisedChannel._id + '.' + ctx.mediatorResponse.properties.name + '.mediator_metrics.' + metric.name, metric.value

          if metric.type == 'gauge'
            logger.info 'incrementing mediator gauge ' + metric.name
            sdc.gauge domain + '.channels.' + ctx.authorisedChannel._id + '.' + ctx.mediatorResponse.properties.name + '.mediator_metrics.' + metric.name, metric.value


      if ctx.mediatorResponse.orchestrations?
        for orchestration in ctx.mediatorResponse.orchestrations
          orchestrationStatus = orchestration.response.status
          sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.orchestrations.' + orchestration.name
          sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.orchestrations.' + orchestration.name + '.statusCodes.' + orchestrationStatus
          sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.statuses.' + transactionStatus + '.orchestrations.' + orchestration.name
          sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.statuses.' + transactionStatus + '.orchestrations.' + orchestration.name + '.statusCodes.' + orchestrationStatus

          if orchestration.metrics?
            for metric in orchestration.metrics
              if metric.type == 'counter'
                logger.info 'incrementing orchestration counter ' + metric.name
                sdc.increment   domain + '.channels.' + ctx.authorisedChannel._id + '.' + ctx.mediatorResponse.properties.name + '.orchestrations.' + orchestration.name + '.' + metric.name, metric.value

              if metric.type == 'timer'
                logger.info 'incrementing orchestration timer ' + metric.name
                sdc.timing      domain + '.channels.' + ctx.authorisedChannel._id + '.' + ctx.mediatorResponse.properties.name + '.orchestrations.' + orchestration.name + '.' + metric.name, metric.value

              if metric.type == 'gauge'
                logger.info 'incrementing orchestration gauge ' + metric.name
                sdc.gauge       domain + '.channels.' + ctx.authorisedChannel._id + '.' + ctx.mediatorResponse.properties.name + '.orchestrations.' + orchestration.name  + '.' + metric.name, metric.value

  catch error
    logger.error error, done
  done()


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
  done()

exports.koaMiddleware = `function *statsMiddleware(next) {
    timer = new Date();
    yield next;
    exports.incrementTransactionCount(this,function(){})
    exports.measureTransactionDuration(this,function(){})
    sdc.close();
}`
