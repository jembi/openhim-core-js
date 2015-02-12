VisualizerEvent = require('../model/events').VisualizerEvent

exports.getLatestEvents = ->
  try
    rtDate = new Date(Number(receivedTime))
    result = yield VisualizerEvent.find({ 'created': { '$gte': rtDate } }).sort({ 'ts': 1 }).exec()
    this.body = { events: result }
  catch err
    logAndSetResponse this, 'internal server error', "Could not fetch the latest visualizer events via the API: #{err}", 'error'

exports.sync = ->
  try
    this.body = { now: Date.now() }
  catch err
    logAndSetResponse this, 'internal server error', "Could not fetch current date via the API: #{err}", 'error'
