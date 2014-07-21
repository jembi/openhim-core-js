config = require "./config/config"
config.alerts = config.get('alerts')
logger = require "winston"
Channel = require('./model/channels').Channel
Transaction = require('./model/transactions').Transaction


getAllChannels = (callback) -> Channel.find({}).exec callback

findTransactionsMatchingStatus = (channelID, status, dateFrom, failureRate, callback) ->
	pat = /\dxx/.exec status
	if pat
		statusMatch = "$gte": status[0]*100, "$lt": status[0]*100+100
	else
		statusMatch = status

	Transaction.find({
		"request.timestamp": $gte: dateFrom
		channelID: channelID
		"$or": [
			{ "response.status": statusMatch }
			{ routes: "$elemMatch": "response.status": statusMatch }
		]
	}, '_id').exec (err, results) ->
		if not err and results? and failureRate? and results.length < failureRate
			callback err, []
		else
			callback err, results

alertingTask = (job, done) ->
	logger.info "Running transaction alerts task"
	job.attrs.data = {} if not job.attrs.data

	lastAlertDate = job.attrs.data.lastAlertDate ? new Date()

	getAllChannels (err, results) ->
		for channel in results
			for alert in channel.alerts
				findTransactionsMatchingStatus channelID, alert.status, lastAlertDate, alert.failureRate, (err, trx) ->
					console.log "do stuff"

	job.attrs.data.lastAlertDate = new Date()
	done()

setupAgenda = (agenda) ->
	agenda.define 'generate transaction alerts', (job, done) -> alertingTask job, done
	agenda.every "#{config.alerts.pollPeriodMinutes} minutes", 'generate transaction alerts'


exports.setupAgenda = setupAgenda

if process.env.NODE_ENV == "test"
	exports.findTransactionsMatchingStatus = findTransactionsMatchingStatus
