import logger from 'winston'
import { VisualizerModelAPI } from '../model/visualizer'
import * as authorisation from './authorisation'
import * as utils from '../utils'

// Endpoint that returns all visualizers
export async function getVisualizers (ctx) {
  // Must be admin
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    return utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to getVisualizers denied.`, 'info')
  }

  try {
    ctx.body = await VisualizerModelAPI.find().exec()
  } catch (err) {
    utils.logAndSetResponse(ctx, 500, `Could not fetch visualizers via the API: ${err}`, 'error')
  }
}

// Endpoint that returns specific visualizer by visualizerId
export async function getVisualizer (ctx, visualizerId) {
  // Must be admin
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    return utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to getVisualizer denied.`, 'info')
  }

  visualizerId = unescape(visualizerId)

  try {
    const result = await VisualizerModelAPI.findById(visualizerId).exec()
    if (!result) {
      ctx.body = `Visualizer with _id ${visualizerId} could not be found.`
      ctx.status = 404
    } else {
      ctx.body = result
    }
  } catch (err) {
    utils.logAndSetResponse(ctx, 500, `Could not fetch visualizer via the API: ${err}`, 'error')
  }
}

// Endpoint to add new visualizer
export async function addVisualizer (ctx) {
  // Must be admin user
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    return utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to addVisualizer denied.`, 'info')
  }

  if (!ctx.request.rawBody) {
    return utils.logAndSetResponse(ctx, 404, 'Cannot Add Visualizer, no request object', 'info')
  }

  try {
    const visualizer = new VisualizerModelAPI(ctx.request.body)
    await visualizer.save()

    ctx.body = 'Visualizer successfully created'
    ctx.status = 201
    logger.info('User %s created visualizer with id %s', ctx.authenticated.email, visualizer.id)
  } catch (err) {
    utils.logAndSetResponse(ctx, 500, `Could not add visualizer via the API: ${err}`, 'error')
  }
}

// Endpoint to update specific visualizer by visualizerId
export async function updateVisualizer (ctx, visualizerId) {
  // Must be admin
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    return utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to updateVisualizer denied.`, 'info')
  }

  if (!ctx.request.rawBody) {
    return utils.logAndSetResponse(ctx, 404, `Cannot Update Visualizer with _id ${visualizerId}, no request object`, 'info')
  }

  const visualizerData = ctx.request.body

  visualizerId = unescape(visualizerId)
  // Ignore _id if it exists, a user shouldn't be able to update the internal id
  if (visualizerData._id) { delete visualizerData._id }

  try {
    const result = await VisualizerModelAPI.findByIdAndUpdate(visualizerId, visualizerData).exec()
    if (!result) {
      return utils.logAndSetResponse(ctx, 404, `Cannot Update Visualizer with _id ${visualizerId}, does not exist`, 'info')
    }

    ctx.body = `Successfully updated visualizer with _id ${visualizerId}`
    logger.info(`User ${ctx.authenticated.email} updated visualizer with _id ${visualizerId}`)
  } catch (e) {
    utils.logAndSetResponse(ctx, 500, `Could not update visualizer with _id ${visualizerId} via the API ${e}`, 'error')
  }
}

// Endpoint to remove specific visualizer by visualizerId
export async function removeVisualizer (ctx, visualizerId) {
  // Must be admin
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    return utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to removeVisualizer denied.`, 'info')
  }

  visualizerId = unescape(visualizerId)

  try {
    const v = await VisualizerModelAPI.findByIdAndRemove(visualizerId).exec()
    if (!v) {
      return utils.logAndSetResponse(ctx, 404, `Could not find visualizer with _id ${visualizerId}`, 'info')
    }

    ctx.body = `Successfully removed visualizer with _id ${visualizerId}`
    logger.info(`User ${ctx.authenticated.email} removed visualizer with _id ${visualizerId}`)
  } catch (e) {
    utils.logAndSetResponse(ctx, 500, `Could not remove visualizer with _id ${visualizerId} via the API ${e}`, 'error')
  }
}
