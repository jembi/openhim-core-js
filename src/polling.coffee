Channel = require('./model/channels').Channel
request = require 'request'
config = require './config/config'
config.polling = config.get('polling')
logger = require 'winston'
Q = require 'q'
logger = require 'winston'
authorisation = require './middleware/authorisation'

exports.agendaGlobal = null

exports.registerPollingChannel = (channel, callback) ->
  logger.info "Registering polling channel: #{channel._id}"
  return callback new Error 'no polling schedule set on this channel' if not channel.pollingSchedule

  exports.agendaGlobal.cancel { name: "polling-job-#{channel._id}" }, (err) ->
    return callback err if err
    exports.agendaGlobal.define "polling-job-#{channel._id}", (job, done) ->
      logger.info "Polling channel #{channel._id}"

      options =
        url: "http://#{config.polling.host}:#{config.polling.pollingPort}/trigger"
        headers:
          'channel-id': channel._id
          'X-OpenHIM-LastRunAt': job.attrs.lastRunAt

      request options, ->
        done()

    exports.agendaGlobal.every channel.pollingSchedule, "polling-job-#{channel._id}"

    callback null

exports.removePollingChannel = removePollingChannel = (channel, callback) ->
  logger.info "Removing polling schedule for channel: #{channel._id}"
  exports.agendaGlobal.cancel { name: "polling-job-#{channel._id}" }, (err) ->
    return callback err if err
    callback null

exports.setupAgenda = (agenda, callback) ->
  logger.info "Starting polling server..."
  registerPollingChannelPromise = Q.denodeify exports.registerPollingChannel
  exports.agendaGlobal = agenda
  Channel.find { type: 'polling' }, (err, channels) ->
    return err if err

    promises = []
    for channel in channels
      if authorisation.isChannelEnabled channel
        promises.push registerPollingChannelPromise channel

    (Q.all promises).done callback
