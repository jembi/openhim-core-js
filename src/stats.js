import SDC from 'statsd-client'
import logger from 'winston'
import os from 'os'
import { config } from './config'

const statsdServer = config.get('statsd')
const application = config.get('application')

const domain = `${os.hostname()}.${application.name}`
const sdc = new SDC(statsdServer)

export function incrementTransactionCount (ctx, done) {
  logger.info(`sending counts to statsd for ${domain}.${ctx.authorisedChannel._id}`)
  const {transactionStatus} = ctx
  try {
    sdc.increment(`${domain}.channels`) // Overall Counter
    sdc.increment(`${domain}.channels.${transactionStatus}`) // Overall Transaction Status
    sdc.increment(`${domain}.channels.${ctx.authorisedChannel._id}`) // Per channel
    sdc.increment(`${domain}.channels.${ctx.authorisedChannel._id}.statuses.${transactionStatus}`) // Per Channel Status

    if (ctx.mediatorResponse != null) {
      // Check for custom mediator metrics
      let metric
      if (ctx.mediatorResponse.metrics != null) {
        for (metric of Array.from(ctx.mediatorResponse.metrics)) {
          if (metric.type === 'counter') {
            logger.info(`incrementing mediator counter ${metric.name}`)
            sdc.increment(`${domain}.channels.${ctx.authorisedChannel._id}.${ctx.mediatorResponse.properties.name}.mediator_metrics.${metric.name}`)
          }

          if (metric.type === 'timer') {
            logger.info(`incrementing mediator timer ${metric.name}`)
            sdc.timing(`${domain}.channels.${ctx.authorisedChannel._id}.${ctx.mediatorResponse.properties.name}.mediator_metrics.${metric.name}`, metric.value)
          }

          if (metric.type === 'gauge') {
            logger.info(`incrementing mediator gauge ${metric.name}`)
            sdc.gauge(`${domain}.channels.${ctx.authorisedChannel._id}.${ctx.mediatorResponse.properties.name}.mediator_metrics.${metric.name}`, metric.value)
          }
        }
      }

      if (ctx.mediatorResponse.orchestrations != null) {
        for (const orchestration of Array.from(ctx.mediatorResponse.orchestrations)) {
          const orchestrationStatus = orchestration.response.status
          let orchestrationName = orchestration.name
          if (orchestration.group) {
            orchestrationName = `${orchestration.group}.${orchestration.name}` // Namespace it by group
          }
          sdc.increment(`${domain}.channels.${ctx.authorisedChannel._id}.orchestrations.${orchestrationName}`)
          sdc.increment(`${domain}.channels.${ctx.authorisedChannel._id}.orchestrations.${orchestrationName}.statusCodes.${orchestrationStatus}`)
          sdc.increment(`${domain}.channels.${ctx.authorisedChannel._id}.statuses.${transactionStatus}.orchestrations.${orchestrationName}`)
          sdc.increment(`${domain}.channels.${ctx.authorisedChannel._id}.statuses.${transactionStatus}.orchestrations.${orchestrationName}.statusCodes.${orchestrationStatus}`)

          if (orchestration.metrics != null) {
            for (metric of Array.from(orchestration.metrics)) {
              if (metric.type === 'counter') {
                logger.info(`incrementing orchestration counter ${metric.name}`)
                sdc.increment(`${domain}.channels.${ctx.authorisedChannel._id}.${ctx.mediatorResponse.properties.name}.orchestrations.${orchestrationName}.${metric.name}`, metric.value)
              }

              if (metric.type === 'timer') {
                logger.info(`incrementing orchestration timer ${metric.name}`)
                sdc.timing(`${domain}.channels.${ctx.authorisedChannel._id}.${ctx.mediatorResponse.properties.name}.orchestrations.${orchestrationName}.${metric.name}`, metric.value)
              }

              if (metric.type === 'gauge') {
                logger.info(`incrementing orchestration gauge ${metric.name}`)
                sdc.gauge(`${domain}.channels.${ctx.authorisedChannel._id}.${ctx.mediatorResponse.properties.name}.orchestrations.${orchestrationName}.${metric.name}`, metric.value)
              }
            }
          }
        }
      }
    }
    return done()
  } catch (error) {
    logger.error(error, done)
  }
}

export function measureTransactionDuration (ctx, done) {
  logger.info(`sending durations to statsd for ${domain}.${ctx.authorisedChannel._id}`)
  const {transactionStatus} = ctx

  try {
    sdc.timing(`${domain}.channels`, ctx.timer) // Overall Timer
    sdc.timing(`${domain}.channels.${transactionStatus}`, ctx.timer) // Overall Transaction Status
    sdc.timing(`${domain}.channels.${ctx.authorisedChannel._id}`, ctx.timer) // Per Channel
    sdc.timing(`${domain}.channels.${ctx.authorisedChannel._id}.statuses.${transactionStatus}`, ctx.timer) // Per Channel Status

    if (ctx.mediatorResponse != null) {
      if (ctx.mediatorResponse.orchestrations != null) {
        for (const orchestration of Array.from(ctx.mediatorResponse.orchestrations)) {
          (function (orchestration) {
            const orchestratrionDuration = orchestration.response.timestamp - orchestration.request.timestamp
            const orchestrationStatus = orchestration.response.status
            let orchestrationName = orchestration.name
            if (orchestration.group) {
              orchestrationName = `${orchestration.group}.${orchestration.name}` // Namespace it by group
            }

            sdc.timing(`${domain}.channels.${ctx.authorisedChannel._id}.orchestrations.${orchestrationName}`, orchestratrionDuration)
            return sdc.timing(`${domain}.channels.${ctx.authorisedChannel._id}.orchestrations.${orchestrationName}.statusCodes.${orchestrationStatus}`, orchestratrionDuration)
          }(orchestration))
        }
      }
    }
  } catch (error) {
    logger.error(error, done)
  }
  return done()
}

export function nonPrimaryRouteRequestCount (ctx, route, done) {
  let metric
  sdc.increment(`${domain}.channels.${ctx.authorisedChannel._id}.nonPrimaryRoutes.${route.name}`) // Per non-primary route
  sdc.increment(`${domain}.channels.${ctx.authorisedChannel._id}.nonPrimaryRoutes.${route.name}.statusCodes.${route.response.status}`) // Per route response status

  if (route.metrics != null) {
    for (metric of Array.from(route.metrics)) {
      if (metric.type === 'counter') {
        logger.info(`incrementing mediator counter ${metric.name}`)
        sdc.increment(`${domain}.channels.${ctx.authorisedChannel._id}.nonPrimaryRoutes.${route.name}.mediator_metrics.${metric.name}`)
      }

      if (metric.type === 'timer') {
        logger.info(`incrementing mediator timer ${metric.name}`)
        sdc.timing(`${domain}.channels.${ctx.authorisedChannel._id}.nonPrimaryRoutes.${route.name}.mediator_metrics.${metric.name}`, metric.value)
      }

      if (metric.type === 'gauge') {
        logger.info(`incrementing mediator gauge ${metric.name}`)
        sdc.gauge(`${domain}.channels.${ctx.authorisedChannel._id}.nonPrimaryRoutes.${route.name}.mediator_metrics.${metric.name}`, metric.value)
      }
    }
  }

  if (route.orchestrations != null) {
    for (const orchestration of Array.from(route.orchestrations)) {
      const orchestrationStatus = orchestration.response.status
      let orchestrationName = orchestration.name
      if (orchestration.group) {
        orchestrationName = `${orchestration.group}.${orchestration.name}` // Namespace it by group
      }
      sdc.increment(`${domain}.channels.${ctx.authorisedChannel._id}.nonPrimaryRoutes.${route.name}.orchestrations.${orchestrationName}`)
      sdc.increment(`${domain}.channels.${ctx.authorisedChannel._id}.nonPrimaryRoutes.${route.name}.orchestrations.${orchestrationName}.statusCodes.${orchestrationStatus}`)
      sdc.increment(`${domain}.channels.${ctx.authorisedChannel._id}.nonPrimaryRoutes.${route.name}.statusCodes.${route.response.status}.orchestrations.${orchestrationName}`)
      sdc.increment(`${domain}.channels.${ctx.authorisedChannel._id}.nonPrimaryRoutes.${route.name}.statusCodes.${route.response.status}.orchestrations.${orchestrationName}.statusCodes.${orchestrationStatus}`)

      // Log custom orchestration metrics
      if (orchestration.metrics != null) {
        return (() => {
          const result = []
          for (metric of Array.from(orchestration.metrics)) {
            let item
            if (metric.type === 'counter') {
              logger.info(`incrementing ${route.name} orchestration counter ${metric.name}`)
              sdc.increment(`${domain}.channels.${ctx.authorisedChannel._id}.nonPrimaryRoutes.${route.name}.orchestrations.${orchestrationName}.${metric.name}`, metric.value)
            }

            if (metric.type === 'timer') {
              logger.info(`incrementing ${route.name}orchestration timer ${metric.name}`)
              sdc.timing(`${domain}.channels.${ctx.authorisedChannel._id}.nonPrimaryRoutes.${route.name}.orchestrations.${orchestrationName}.${metric.name}`, metric.value)
            }

            if (metric.type === 'gauge') {
              logger.info(`incrementing ${route.name}orchestration gauge ${metric.name}`)
              item = sdc.gauge(`${domain}.channels.${ctx.authorisedChannel._id}.nonPrimaryRoutes.${route.name}.orchestrations.${orchestrationName}.${metric.name}`, metric.value)
            }
            result.push(item)
          }
          return result
        })()
      }
    }
  }
  return done()
}

export function nonPrimaryRouteDurations (ctx, route, done) {
  sdc.timing(`${domain}.channels.${ctx.authorisedChannel._id}.nonPrimaryRoutes.${route.name}`, ctx.timer)
  sdc.timing(`${domain}.channels.${ctx.authorisedChannel._id}.nonPrimaryRoutes.${route.name}.statusCodes.${route.response.status}`, ctx.timer)

  if (route.orchestrations != null) {
    for (const orchestration of Array.from(route.orchestrations)) {
      (function (orchestration) {
        const orchestratrionDuration = orchestration.response.timestamp - orchestration.request.timestamp
        const orchestrationStatus = orchestration.response.status
        let orchestrationName = orchestration.name
        if (orchestration.group) {
          orchestrationName = `${orchestration.group}.${orchestration.name}` // Namespace it by group
        }
        sdc.timing(`${domain}.channels.${ctx.authorisedChannel._id}.nonPrimaryRoutes.${route.name}.orchestrations.${orchestrationName}`, orchestratrionDuration)
        sdc.timing(`${domain}.channels.${ctx.authorisedChannel._id}.nonPrimaryRoutes.${route.name}.orchestrations.${orchestrationName}.statusCodes.${orchestrationStatus}`, orchestratrionDuration)
        sdc.timing(`${domain}.channels.${ctx.authorisedChannel._id}.nonPrimaryRoutes.${route.name}.statusCodes.${route.response.status}.orchestrations.${orchestrationName}`, orchestratrionDuration)
        return sdc.timing(`${domain}.channels.${ctx.authorisedChannel._id}.nonPrimaryRoutes.${route.name}.statusCodes.${route.response.status}.orchestrations.${orchestrationName}.statusCodes.${orchestrationStatus}`, orchestratrionDuration)
      }(orchestration))
    }
  }

  return done()
}
