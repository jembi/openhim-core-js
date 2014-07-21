config = require "./config/config"
config.alerts = config.get('alerts')
logger = require "winston"
Channel = require('./model/channels').Channel
Transaction = require('./model/transactions').Transaction


getAllChannels = (callback) -> Channel.find({}).exec callback

findTransactionsMatchingStatus = (channelId, status, dateFrom, callback) ->
	pat = /(\d)xx/.exec status
	statusMatch = if pat then new RegExp("#{pat[0]}\d\d") else status
	console.log "channeId: #{channelId}"
	console.log "statusMatch: #{statusMatch}"
	console.log "dateFrom: #{dateFrom}"

	Transaction.find({
	#	request: timestamp: $gte: dateFrom
	#	"$or": [
	#		{ response: status: statusMatch }
	#		{ routes: "$elemMatch": response: status: statusMatch }
	#	]
	}, '_id').exec callback

alertingTask = (job, done) ->
	logger.info "Running transaction alerts task"
	job.attrs.data = {} if not job.attrs.data

	lastAlertDate = job.attrs.data.lastAlertDate ? new Date()

	getAllChannels (err, results) ->
		for channel in results
			for alert in channel.alerts
				status = ""
				findTransactionsMatchingStatus channel._id, status, lastAlertDate, (err, trx) ->
					console.log "do stuff"

	job.attrs.data.lastAlertDate = new Date()
	done()

setupAgenda = (agenda) ->
	agenda.define 'generate transaction alerts', (job, done) -> alertingTask job, done
	agenda.every "#{config.alerts.pollPeriodMinutes} minutes", 'generate transaction alerts'


exports.setupAgenda = setupAgenda

if process.env.NODE_ENV == "test"
	exports.findTransactionsMatchingStatus = findTransactionsMatchingStatus
