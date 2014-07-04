config = require "./config/config"
config.alerts = config.get('alerts')
logger = require "winston"
Channel = require('./model/channels').Channel
Transaction = require('./model/transactions').Transaction


getAllChannels = (callback) -> Channel.find({}).exec callback

findTransactionsMatchingStatus = (status, dateFrom, callback) ->
	pat = /\dxx/.exec status
	statusMatch = if pat then pat[0] else status

	Transaction.find({
		request: timestamp: $gte: dateFrom
		"$or": [
			{ response: status: statusMatch }
			{ routes: "$elemMatch": response: status: statusMatch }
		]
	}, ['_id']).exec callback

alertingTask = (job, done) ->
	logger.info "Running transaction alerts task"
	job.attrs.data = {} if not job.attrs.data

	lastAlertDate = job.attrs.data.lastAlertDate ? new Date()

	job.attrs.data.lastAlertDate = new Date()
	done()

setupAgenda = (agenda) ->
	agenda.define 'generate transaction alerts', (job, done) -> alertingTask job, done
	agenda.every "#{config.alerts.pollPeriodMinutes} minutes", 'generate transaction alerts'


exports.setupAgenda = setupAgenda

if process.env.NODE_ENV == "test"
	exports.findTransactionsMatchingStatus = findTransactionsMatchingStatus
