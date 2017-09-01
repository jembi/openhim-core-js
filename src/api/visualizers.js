import Q from 'q'
import logger from 'winston'
import { VisualizerModelAPI } from '../model/visualizer'
import * as authorisation from './authorisation'
import * as utils from '../utils'

// Endpoint that returns all visualizers
export function * getVisualizers () {
  // Must be admin
  if (!authorisation.inGroup('admin', this.authenticated)) {
    return utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to getVisualizers denied.`, 'info')
  }

  try {
    this.body = yield VisualizerModelAPI.find().exec()
  } catch (err) {
    return utils.logAndSetResponse(this, 500, `Could not fetch visualizers via the API: ${err}`, 'error')
  }
}

// Endpoint that returns specific visualizer by visualizerId
export function * getVisualizer (visualizerId) {
  // Must be admin
  if (!authorisation.inGroup('admin', this.authenticated)) {
    return utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to getVisualizer denied.`, 'info')
  }

  visualizerId = unescape(visualizerId)

  try {
    const result = yield VisualizerModelAPI.findById(visualizerId).exec()
    if (!result) {
      this.body = `Visualizer with _id ${visualizerId} could not be found.`
      this.status = 404
    } else {
      this.body = result
    }
  } catch (err) {
    return utils.logAndSetResponse(this, 500, `Could not fetch visualizer via the API: ${err}`, 'error')
  }
}

// Endpoint to add new visualizer
export function * addVisualizer () {
  // Must be admin user
  if (!authorisation.inGroup('admin', this.authenticated)) {
    return utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to addVisualizer denied.`, 'info')
  }

  const visualizerData = this.request.body
  if (!visualizerData) {
    return utils.logAndSetResponse(this, 404, 'Cannot Add Visualizer, no request object', 'info')
  }

  try {
    const visualizer = new VisualizerModelAPI(visualizerData)
    yield Q.ninvoke(visualizer, 'save')

    this.body = 'Visualizer successfully created'
    this.status = 201
    return logger.info('User %s created visualizer with id %s', this.authenticated.email, visualizer.id)
  } catch (err) {
    return utils.logAndSetResponse(this, 500, `Could not add visualizer via the API: ${err}`, 'error')
  }
}

// Endpoint to update specific visualizer by visualizerId
export function * updateVisualizer (visualizerId) {
  // Must be admin
  if (!authorisation.inGroup('admin', this.authenticated)) {
    return utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to updateVisualizer denied.`, 'info')
  }

  const visualizerData = this.request.body
  if (!visualizerData) {
    return utils.logAndSetResponse(this, 404, `Cannot Update Visualizer with _id ${visualizerId}, no request object`, 'info')
  }

  visualizerId = unescape(visualizerId)

  // Ignore _id if it exists, a user shouldn't be able to update the internal id
  if (visualizerData._id) { delete visualizerData._id }

  try {
    const result = yield VisualizerModelAPI.findByIdAndUpdate(visualizerId, visualizerData).exec()
    if (!result) {
      return utils.logAndSetResponse(this, 404, `Cannot Update Visualizer with _id ${visualizerId}, does not exist`, 'info')
    }

    this.body = `Successfully updated visualizer with _id ${visualizerId}`
    return logger.info(`User ${this.authenticated.email} updated visualizer with _id ${visualizerId}`)
  } catch (e) {
    return utils.logAndSetResponse(this, 500, `Could not update visualizer with _id ${visualizerId} via the API ${e}`, 'error')
  }
}

// Endpoint to remove specific visualizer by visualizerId
export function * removeVisualizer (visualizerId) {
  // Must be admin
  if (!authorisation.inGroup('admin', this.authenticated)) {
    return utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to removeVisualizer denied.`, 'info')
  }

  visualizerId = unescape(visualizerId)

  try {
    const v = yield VisualizerModelAPI.findByIdAndRemove(visualizerId).exec()
    if (!v) {
      return utils.logAndSetResponse(this, 404, `Could not find visualizer with _id ${visualizerId}`, 'info')
    }

    this.body = `Successfully removed visualizer with _id ${visualizerId}`
    return logger.info(`User ${this.authenticated.email} removed visualizer with _id ${visualizerId}`)
  } catch (e) {
    return utils.logAndSetResponse(this, 500, `Could not remove visualizer with _id ${visualizerId} via the API ${e}`, 'error')
  }
}
