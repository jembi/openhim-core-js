VisualizerEvent = require('../model/events').VisualizerEvent
utils = require "../utils"

exports.getLatestEvents = (receivedTime) ->
  try
    rtDate = new Date(Number(receivedTime))
    result = yield VisualizerEvent.find({ 'created': { '$gte': rtDate } }).sort({ 'ts': 1 }).exec()
    this.body = events: result
  catch err
    utils.logAndSetResponse this, 'internal server error', "Could not fetch the latest visualizer events via the API: #{err}", 'error'

exports.sync = (next) ->
  try
    this.body = now: Date.now()
    yield next
  catch err
    utils.logAndSetResponse this, 'internal server error', "Could not fetch current date via the API: #{err}", 'error'
