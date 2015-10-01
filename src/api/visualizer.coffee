Event = require('../model/events').Event
utils = require "../utils"


exports.getLatestEvents = (receivedTime) ->
  try
    rtDate = new Date(Number(receivedTime))
    results = yield Event.find({ 'created': { '$gte': rtDate } }).sort({ 'visualizerTimestamp': 1 }).exec()

    formattedResults = []

    for event in results
      fEvent =
        created: event.created
        ev: event.event
        status: event.visualizerStatus
        ts: event.visualizerTimestamp

      if event.route is 'primary'
        fEvent.comp = event.name

        #add channel event
        formattedResults.push
          created: event.created
          comp: "channel-#{event.name}"
          ev: event.event
          status: event.visualizerStatus
          ts: event.visualizerTimestamp
      else
        fEvent.comp = "#{event.route}-#{event.name}"

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
