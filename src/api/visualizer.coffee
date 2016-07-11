Event = require('../model/events').Event
utils = require "../utils"
authorisation = require './authorisation'

###
# DEPRECATED
#
# superseded by /events
###

exports.getLatestEvents = (receivedTime) ->
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to events denied.", 'info'
    return

  try
    rtDate = new Date(Number(receivedTime))
    results = yield Event.find({ 'created': { '$gte': rtDate } }).sort({ 'normalizedTimestamp': 1 }).exec()

    formattedResults = []

    for event in results
      fEvent =
        comp: "#{event.route}-#{event.name}"
        created: event.created
        ev: event.event
        status: event.statusType
        ts: event.normalizedTimestamp

      formattedResults.push fEvent

    this.body = events: formattedResults
  catch err
    utils.logAndSetResponse this, 500, "Could not fetch the latest visualizer events via the API: #{err}", 'error'


exports.sync = (next) ->
  try
    this.body = now: Date.now()
    yield next
  catch err
    utils.logAndSetResponse this, 500, "Could not fetch current date via the API: #{err}", 'error'
