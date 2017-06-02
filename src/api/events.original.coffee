Event = require('../model/events').Event
authorisation = require './authorisation'
utils = require "../utils"


exports.getLatestEvents = (receivedTime) ->
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to events denied.", 'info'
    return

  try
    rtDate = new Date(Number(receivedTime))
    results = {} #TODO:Fix yield Event.find({ 'created': { '$gte': rtDate } }).sort({ 'normalizedTimestamp': 1 }).exec()
    this.body = events: results
  catch err
    utils.logAndSetResponse this, 500, "Could not fetch the latest events via the API: #{err}", 'error'
