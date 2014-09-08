Channel = require('./model/channels').Channel
request = require 'request'
config = require './config/config'
config.polling = config.get('polling')
logger = require 'winston'
Q = require 'q'

exports.agendaGlobal = null

exports.registerPollingChannel = (channel, callback) ->
	return callback new Error 'no polling schedule set on this channel' if not channel.pollingSchedule

	exports.agendaGlobal.cancel { name: "polling-job-#{channel._id}" }, (err) ->
		return callback err if err
		exports.agendaGlobal.define "polling-job-#{channel._id}", (job, done) ->
			request "http://#{config.polling.host}:#{config.polling.pollingPort}/trigger", ->
				done()

		exports.agendaGlobal.every channel.pollingSchedule, "polling-job-#{channel._id}"

		callback null

exports.removePollingChannel = removePollingChannel = (channel, callback) ->
	exports.agendaGlobal.cancel { name: "polling-job-#{channel._id}" }, (err) ->
		return callback err if err
		callback null

exports.setupAgenda = (agenda, callback) ->
	registerPollingChannelPromise = Q.denodeify exports.registerPollingChannel
	exports.agendaGlobal = agenda
	Channel.find { type: 'polling' }, (err, channels) ->
		return err if err

		promises = []
		for channel in channels
			promises.push registerPollingChannelPromise channel

		(Q.all promises).done callback

