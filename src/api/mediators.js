import logger from 'winston'
import semver from 'semver'
import atna from 'atna-audit'
import { ChannelModelAPI } from '../model/channels'
import { MediatorModelAPI } from '../model/mediators'
import * as authorisation from './authorisation'
import * as utils from '../utils'
import * as auditing from '../auditing'

const mask = '**********'

function maskPasswords (defs, config) {
  if (!config) {
    return
  }

  return defs.forEach((d) => {
    if ((d.type === 'password') && config[d.param]) {
      if (d.array) {
        config[d.param] = config[d.param].map(() => mask)
      } else {
        config[d.param] = mask
      }
    }
    if ((d.type === 'struct') && config[d.param]) {
      return maskPasswords(d.template, config[d.param])
    }
  })
}

function restoreMaskedPasswords (defs, maskedConfig, config) {
  if (!maskedConfig || !config) {
    return
  }

  return defs.forEach((d) => {
    if ((d.type === 'password') && maskedConfig[d.param] && config[d.param]) {
      if (d.array) {
        maskedConfig[d.param].forEach((p, i) => {
          if (p === mask) {
            maskedConfig[d.param][i] = config[d.param][i]
          }
        })
      } else if (maskedConfig[d.param] === mask) {
        maskedConfig[d.param] = config[d.param]
      }
    }
    if ((d.type === 'struct') && maskedConfig[d.param] && config[d.param]) {
      return restoreMaskedPasswords(d.template, maskedConfig[d.param], config[d.param])
    }
  })
}

export async function getAllMediators (ctx) {
  // Must be admin
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to getAllMediators denied.`, 'info')
    return
  }

  try {
    const mediator = await MediatorModelAPI.find().exec()
    maskPasswords(mediator.configDefs, mediator.config)
    ctx.body = mediator
  } catch (err) {
    utils.logAndSetResponse(ctx, 500, `Could not fetch mediators via the API: ${err}`, 'error')
  }
}

export async function getMediator (ctx, mediatorURN) {
  // Must be admin
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to getMediator denied.`, 'info')
    return
  }

  const urn = unescape(mediatorURN)

  try {
    const result = await MediatorModelAPI.findOne({urn}).exec()
    if (result === null) {
      ctx.status = 404
    } else {
      maskPasswords(result.configDefs, result.config)
      ctx.body = result
    }
  } catch (err) {
    utils.logAndSetResponse(ctx, 500, `Could not fetch mediator using UUID ${urn} via the API: ${err}`, 'error')
  }
}

function constructError (message, name) {
  const err = new Error(message)
  err.name = name
  return err
}

function validateConfigDef (def) {
  if (def.type === 'struct' && !def.template) {
    throw constructError(`Must specify a template for struct param '${def.param}'`, 'ValidationError')
  } else if (def.type === 'struct') {
    for (const templateItem of Array.from(def.template)) {
      if (!templateItem.param) {
        throw constructError(`Must specify field 'param' in template definition for param '${def.param}'`, 'ValidationError')
      }

      if (!templateItem.type) {
        throw constructError(`Must specify field 'type' in template definition for param '${def.param}'`, 'ValidationError')
      }

      if (templateItem.type === 'struct') {
        throw constructError(`May not recursively specify 'struct' in template definitions (param '${def.param}')`, 'ValidationError')
      }
    }
  } else if (def.type === 'option') {
    if (!utils.typeIsArray(def.values)) {
      throw constructError(`Expected field 'values' to be an array (option param '${def.param}')`, 'ValidationError')
    }
    if ((def.values == null) || (def.values.length === 0)) {
      throw constructError(`Must specify a values array for option param '${def.param}'`, 'ValidationError')
    }
  }
}

// validations additional to the mongoose schema validation
const validateConfigDefs = configDefs => Array.from(configDefs).map((def) => validateConfigDef(def))

export async function addMediator (ctx) {
  // Must be admin
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to addMediator denied.`, 'info')
    return
  }

  try {
    let mediatorHost = 'unknown'
    const mediator = ctx.request.body

    if (mediator != null && mediator.endpoints != null && mediator.endpoints.length > 0 && mediator.endpoints[0].host != null) {
      mediatorHost = mediator.endpoints[0].host
    }

    // audit mediator start
    let audit = atna.construct.appActivityAudit(true, mediator.name, mediatorHost, 'system')
    audit = atna.construct.wrapInSyslog(audit)
    auditing.sendAuditEvent(audit, () => logger.info(`Processed internal mediator start audit for: ${mediator.name} - ${mediator.urn}`))

    if (!mediator.urn) {
      throw constructError('URN is required', 'ValidationError')
    }
    if (!mediator.version || !semver.valid(mediator.version)) {
      throw constructError('Version is required. Must be in SemVer form x.y.z', 'ValidationError')
    }

    if (mediator.configDefs) {
      validateConfigDefs(mediator.configDefs)
      if (mediator.config != null) {
        validateConfig(mediator.configDefs, mediator.config)
      }
    }

    const existing = await MediatorModelAPI.findOne({urn: mediator.urn}).exec()
    if (existing != null) {
      if (semver.gt(mediator.version, existing.version)) {
        // update the mediator
        if ((mediator.config != null) && (existing.config != null)) {
          // if some config already exists, add only config that didn't exist previously
          for (const param in mediator.config) {
            if (existing.config[param] != null) {
              mediator.config[param] = existing.config[param]
            }
          }
        }
        await MediatorModelAPI.findByIdAndUpdate(existing._id, mediator).exec()
      }
    } else {
      // this is a new mediator validate and save it
      if (!mediator.endpoints || (mediator.endpoints.length < 1)) {
        throw constructError('At least 1 endpoint is required', 'ValidationError')
      }
      await new MediatorModelAPI(mediator).save()
    }
    ctx.status = 201
    logger.info(`User ${ctx.authenticated.email} created mediator with urn ${mediator.urn}`)
  } catch (err) {
    if (err.name === 'ValidationError') {
      utils.logAndSetResponse(ctx, 400, `Could not add Mediator via the API: ${err}`, 'error')
    } else {
      utils.logAndSetResponse(ctx, 500, `Could not add Mediator via the API: ${err}`, 'error')
    }
  }
}

export async function removeMediator (ctx, urn) {
  // Must be admin
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to removeMediator denied.`, 'info')
    return
  }

  urn = unescape(urn)

  try {
    await MediatorModelAPI.findOneAndRemove({urn}).exec()
    ctx.body = `Mediator with urn ${urn} has been successfully removed by ${ctx.authenticated.email}`
    return logger.info(`Mediator with urn ${urn} has been successfully removed by ${ctx.authenticated.email}`)
  } catch (err) {
    return utils.logAndSetResponse(ctx, 500, `Could not remove Mediator by urn ${urn} via the API: ${err}`, 'error')
  }
}

export async function heartbeat (ctx, urn) {
  // Must be admin
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to removeMediator denied.`, 'info')
    return
  }

  urn = unescape(urn)

  try {
    const mediator = await MediatorModelAPI.findOne({urn}).exec()

    if (mediator == null) {
      ctx.status = 404
      return
    }

    const heartbeat = ctx.request.body

    if ((heartbeat != null ? heartbeat.uptime : undefined) == null) {
      ctx.status = 400
      return
    }

    if ((mediator._configModifiedTS > mediator._lastHeartbeat) || ((heartbeat != null ? heartbeat.config : undefined) === true)) {
      // Return config if it has changed since last heartbeat
      ctx.body = mediator.config
    } else {
      ctx.body = ''
    }

    // set internal properties
    if (heartbeat != null) {
      const update = {
        _lastHeartbeat: new Date(),
        _uptime: heartbeat.uptime
      }

      await MediatorModelAPI.findByIdAndUpdate(mediator._id, update).exec()
    }

    ctx.status = 200
  } catch (err) {
    utils.logAndSetResponse(ctx, 500, `Could not process mediator heartbeat (urn: ${urn}): ${err}`, 'error')
  }
}

function validateConfigField (param, def, field) {
  switch (def.type) {
    case 'string':
      if (typeof field !== 'string') {
        throw constructError(`Expected config param ${param} to be a string.`, 'ValidationError')
      }
      break

    case 'bigstring':
      if (typeof field !== 'string') {
        throw constructError(`Expected config param ${param} to be a large string.`, 'ValidationError')
      }
      break

    case 'number':
      if (typeof field !== 'number') {
        throw constructError(`Expected config param ${param} to be a number.`, 'ValidationError')
      }
      break

    case 'bool':
      if (typeof field !== 'boolean') {
        throw constructError(`Expected config param ${param} to be a boolean.`, 'ValidationError')
      }
      break

    case 'option':
      if ((def.values.indexOf(field)) === -1) {
        throw constructError(`Expected config param ${param} to be one of ${def.values}`, 'ValidationError')
      }
      break

    case 'map':
      if (typeof field !== 'object') {
        throw constructError(`Expected config param ${param} to be an object.`, 'ValidationError')
      }
      for (const k in field) {
        const v = field[k]
        if (typeof v !== 'string') {
          throw constructError(`Expected config param ${param} to only contain string values.`, 'ValidationError')
        }
      }
      break

    case 'struct':
      if (typeof field !== 'object') {
        throw constructError(`Expected config param ${param} to be an object.`, 'ValidationError')
      }
      const templateFields = (def.template.map(tp => tp.param))

      for (const paramField in field) {
        if (!Array.from(templateFields).includes(paramField)) {
          throw constructError(`Field ${paramField} is not defined in template definition for config param ${param}.`, 'ValidationError')
        }
      }
      break

    case 'password':
      if (typeof field !== 'string') {
        throw constructError(`Expected config param ${param} to be a string representing a password.`, 'ValidationError')
      }
      break

    default:
      logger.debug(`Unhandled validation case ${def.type}`, 'ValidationError')
      break
  }
}

function validateConfig (configDef, config) {
  // reduce to a single true or false value, start assuming valid
  Object.keys(config).every((param) => {
    // find the matching def if there is one
    const matchingDefs = configDef.filter(def => def.param === param)

    // fail if there isn't a matching def
    if (matchingDefs.length === 0) {
      throw constructError(`No config definition found for parameter ${param}`, 'ValidationError')
    }

    // validate the param against the defs
    return matchingDefs.map((def) => {
      if (def.array) {
        if (!utils.typeIsArray(config[param])) {
          throw constructError(`Expected config param ${param} to be an array of type ${def.type}`, 'ValidationError')
        }

        return Array.from(config[param]).map((field, i) =>
          validateConfigField(`${param}[${i}]`, def, field))
      } else {
        return validateConfigField(param, def, config[param])
      }
    })
  })
}

if (process.env.NODE_ENV === 'test') {
  exports.validateConfig = validateConfig
}

export async function setConfig (ctx, urn) {
  // Must be admin
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to removeMediator denied.`, 'info')
    return
  }

  urn = unescape(urn)
  const config = ctx.request.body

  try {
    const mediator = await MediatorModelAPI.findOne({urn}).exec()

    if (mediator == null) {
      ctx.status = 404
      ctx.body = 'No mediator found for this urn.'
      return
    }
    try {
      restoreMaskedPasswords(mediator.configDefs, config, mediator.config)
      validateConfig(mediator.configDefs, config)
    } catch (error) {
      ctx.status = 400
      ctx.body = error.message
      return
    }

    await MediatorModelAPI.findOneAndUpdate({urn}, {config: ctx.request.body, _configModifiedTS: new Date()}).exec()
    ctx.status = 200
  } catch (error) {
    utils.logAndSetResponse(ctx, 500, `Could not set mediator config (urn: ${urn}): ${error}`, 'error')
  }
}

function saveDefaultChannelConfig (channels, authenticated) {
  const promises = []
  for (const channel of Array.from(channels)) {
    delete channel._id
    for (const route of Array.from(channel.routes)) {
      delete route._id
    }
    channel.updatedBy = utils.selectAuditFields(authenticated)
    promises.push(new ChannelModelAPI(channel).save())
  }
  return promises
}

export async function loadDefaultChannels (ctx, urn) {
  // Must be admin
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to removeMediator denied.`, 'info')
    return
  }

  urn = unescape(urn)
  const channels = ctx.request.body

  try {
    const mediator = await MediatorModelAPI.findOne({urn}).lean().exec()

    if ((mediator == null)) {
      ctx.status = 404
      ctx.body = 'No mediator found for this urn.'
      return
    }

    if ((channels == null) || (channels.length === 0)) {
      await Promise.all(saveDefaultChannelConfig(mediator.defaultChannelConfig, ctx.authenticated))
    } else {
      const filteredChannelConfig = mediator.defaultChannelConfig.filter(channel => Array.from(channels).includes(channel.name))
      if (filteredChannelConfig.length < channels.length) {
        utils.logAndSetResponse(ctx, 400, `Could not load mediator default channel config, one or more channels in the request body not found in the mediator config (urn: ${urn})`, 'error')
        return
      } else {
        await Promise.all(saveDefaultChannelConfig(filteredChannelConfig, ctx.authenticated))
      }
    }

    ctx.status = 201
  } catch (err) {
    logger.debug(err.stack)
    utils.logAndSetResponse(ctx, 500, `Could not load mediator default channel config (urn: ${urn}): ${err}`, 'error')
  }
}
