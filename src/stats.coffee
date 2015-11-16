config = require './config/config'
SDC = require "statsd-client"
statsdServer = config.get 'statsd'
application = config.get 'application'
logger = require "winston"
os = require 'os'
timer = new Date()
domain = os.hostname() + '.' + application.name
util = require 'util'

sdc = new SDC statsdServer

exports.incrementTransactionCount = (ctx, done) ->
  logger.info 'sending counts to statsd for ' + domain + '.' + ctx.authorisedChannel._id
  transactionStatus = ctx.transactionStatus
  try
    sdc.increment domain + '.channels' # Overall Counter
    sdc.increment domain + '.channels.' + transactionStatus #Overall Transaction Status
    sdc.increment domain + '.channels.' + ctx.authorisedChannel._id # Per channel
    sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.statuses.' + transactionStatus # Per Channel Status

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
          do (orchestration) ->
            orchestrationStatus = orchestration.response.status
            orchestrationName = orchestration.name
            if orchestration.group
              orchestrationName = "#{orchestration.group}.#{orchestration.name}" #Namespace it by group
            sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.orchestrations.' + orchestrationName
            sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.orchestrations.' + orchestrationName + '.statusCodes.' + orchestrationStatus
            sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.statuses.' + transactionStatus + '.orchestrations.' + orchestrationName
            sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.statuses.' + transactionStatus + '.orchestrations.' + orchestrationName + '.statusCodes.' + orchestrationStatus

            if orchestration.metrics?
              for metric in orchestration.metrics
                if metric.type == 'counter'
                  logger.info 'incrementing orchestration counter ' + metric.name
                  sdc.increment   domain + '.channels.' + ctx.authorisedChannel._id + '.' + ctx.mediatorResponse.properties.name + '.orchestrations.' + orchestrationName + '.' + metric.name, metric.value

                if metric.type == 'timer'
                  logger.info 'incrementing orchestration timer ' + metric.name
                  sdc.timing      domain + '.channels.' + ctx.authorisedChannel._id + '.' + ctx.mediatorResponse.properties.name + '.orchestrations.' + orchestrationName + '.' + metric.name, metric.value

                if metric.type == 'gauge'
                  logger.info 'incrementing orchestration gauge ' + metric.name
                  sdc.gauge       domain + '.channels.' + ctx.authorisedChannel._id + '.' + ctx.mediatorResponse.properties.name + '.orchestrations.' + orchestrationName  + '.' + metric.name, metric.value

  catch error
    logger.error error, done
  done()


exports.measureTransactionDuration = (ctx, done) ->
  logger.info 'sending durations to statsd for ' + domain + '.' + ctx.authorisedChannel._id
  transactionStatus = ctx.transactionStatus

  try
    sdc.timing domain + '.channels'  , ctx.timer # Overall Timer
    sdc.timing domain + '.channels.' + transactionStatus, ctx.timer # Overall Transaction Status
    sdc.timing domain + '.channels.' + ctx.authorisedChannel._id, ctx.timer # Per Channel
    sdc.timing domain + '.channels.' + ctx.authorisedChannel._id + '.statuses.' + transactionStatus, ctx.timer # Per Channel Status


    if ctx.mediatorResponse?
      if ctx.mediatorResponse.orchestrations?
        for orchestration in ctx.mediatorResponse.orchestrations
          do (orchestration) ->
            orchestratrionDuration = orchestration.response.timestamp - orchestration.request.timestamp
            orchestrationStatus = orchestration.response.status
            orchestrationName = orchestration.name
            if orchestration.group
              orchestrationName = "#{orchestration.group}.#{orchestration.name}" #Namespace it by group

            sdc.timing domain + '.channels.' + ctx.authorisedChannel._id + '.orchestrations.' + orchestrationName, orchestratrionDuration
            sdc.timing domain + '.channels.' + ctx.authorisedChannel._id + '.orchestrations.' + orchestrationName + '.statusCodes.' + orchestrationStatus , orchestratrionDuration


  catch error
    logger.error error, done
  done()


exports.nonPrimaryRouteRequestCount = (ctx, route, done) ->

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
      do (orchestration) ->
        orchestrationStatus = orchestration.response.status
        orchestrationName = orchestration.name
        if orchestration.group
          orchestrationName = "#{orchestration.group}.#{orchestration.name}" #Namespace it by group
        sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.orchestrations.' + orchestrationName
        sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.orchestrations.' + orchestrationName + '.statusCodes.' + orchestrationStatus
        sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.statusCodes.' + route.response.status + '.orchestrations.' + orchestrationName
        sdc.increment domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.statusCodes.' + route.response.status + '.orchestrations.' + orchestrationName + '.statusCodes.' + orchestrationStatus

        # Log custom orchestration metrics
        if orchestration.metrics?
          for metric in orchestration.metrics
            if metric.type == 'counter'
              logger.info 'incrementing '+ route.name + ' orchestration counter ' + metric.name
              sdc.increment   domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.orchestrations.' + orchestrationName + '.' + metric.name, metric.value

            if metric.type == 'timer'
              logger.info 'incrementing '+ route.name + 'orchestration timer ' + metric.name
              sdc.timing      domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.orchestrations.' + orchestrationName + '.' + metric.name, metric.value

            if metric.type == 'gauge'
              logger.info 'incrementing '+ route.name + 'orchestration gauge ' + metric.name
              sdc.gauge       domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.orchestrations.' + orchestrationName  + '.' + metric.name, metric.value
  done()

exports.nonPrimaryRouteDurations = (ctx, route, done) ->

  sdc.timing domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name, ctx.timer
  sdc.timing domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.statusCodes.' + route.response.status, ctx.timer

  if route.orchestrations?
    for orchestration in route.orchestrations
      do (orchestration) ->
        orchestratrionDuration = orchestration.response.timestamp - orchestration.request.timestamp
        orchestrationStatus = orchestration.response.status
        orchestrationName = orchestration.name
        if orchestration.group
          orchestrationName = "#{orchestration.group}.#{orchestration.name}" #Namespace it by group
        sdc.timing domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.orchestrations.' + orchestrationName, orchestratrionDuration
        sdc.timing domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.orchestrations.' + orchestrationName + '.statusCodes.' + orchestrationStatus , orchestratrionDuration
        sdc.timing domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.statusCodes.' + route.response.status + '.orchestrations.' + orchestrationName, orchestratrionDuration
        sdc.timing domain + '.channels.' + ctx.authorisedChannel._id + '.nonPrimaryRoutes.' + route.name + '.statusCodes.' + route.response.status + '.orchestrations.' + orchestrationName + '.statusCodes.' + orchestrationStatus , orchestratrionDuration

  done()
