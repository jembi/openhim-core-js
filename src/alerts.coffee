config = require "./config/config"
config.alerts = config.get('alerts')
logger = require "winston"
contact = require './contact'
moment = require 'moment'
Q = require 'q'
Channel = require('./model/channels').Channel
Transaction = require('./model/transactions').Transaction
ContactGroup = require('./model/contactGroups').ContactGroup
Alert = require('./model/alerts').Alert
User = require('./model/users').User


trxURL = (trx) -> "#{config.alerts.consoleURL}/#/transactions/#{trx._id}"

plainTemplate = (transactions) -> "
ERROR Alert - Transaction Failures\n
\n
The following transaction(s) have failed on the OpenHIM instance running on #{config.alerts.himInstance}:\n
#{(transactions.map (trx) -> trxURL trx).join '\n'}\n
"

htmlTemplate = (transactions) -> "
<html>
<head></head>
<body>
<h1>ERROR Alert - Transaction Failures</h1>
<div>
<p>The following transaction(s) have failed on the OpenHIM instance running on <b>#{config.alerts.himInstance}</b>:</p>
<table>
#{(transactions.map (trx) -> "<tr><td><a href='#{trxURL trx}'>#{trxURL trx}</a></td></tr>").join '\n'}
</table>
</div>
</body>
</html>
"

smsTemplate = (transactions) -> "
ERROR Alert - #{
	if transactions.length > 1
		"#{transactions.length} transactions have failed"
	else if transactions.length is 1
		"1 transaction has failed"
	else
		"no transactions have failed"
}
 on the OpenHIM instance running on #{config.alerts.himInstance}
"


getAllChannels = (callback) -> Channel.find({}).exec callback

findGroup = (name, callback) -> ContactGroup.findOne(group: name).exec callback

findTransactions = (channelID, dateFrom, status, callback) ->
	Transaction.find({
		"request.timestamp": $gte: dateFrom
		channelID: channelID
		"$or": [
			{ "response.status": status }
			{ routes: "$elemMatch": "response.status": status }
		]
	}, '_id').exec callback

countTotalTransactionsForChannel = (channelID, dateFrom, callback) ->
	Transaction.count({
		"request.timestamp": $gte: dateFrom
		channelID: channelID
	}).exec callback

findOneAlert = (channelID, status, dateFrom, user, alertStatus, callback) ->
	criteria = {
		timestamp: { "$gte": dateFrom }
		channelID: channelID
		status: status
		alertStatus: 'Completed'
	}
	criteria.user = user if user
	Alert.findOne criteria, callback


findTransactionsMatchingStatus = (channelID, status, dateFrom, failureRate, callback) ->
	pat = /\dxx/.exec status
	if pat
		statusMatch = "$gte": status[0]*100, "$lt": status[0]*100+100
	else
		statusMatch = status

	dateToCheck = dateFrom
	# check last hour when using failureRate
	dateToCheck = moment().subtract('hours', 1).toDate() if failureRate?

	findTransactions channelID, dateToCheck, statusMatch, (err, results) ->
		if not err and results? and failureRate?
			# Get count of total transactions and work out failure ratio
			countTotalTransactionsForChannel channelID, dateToCheck, (err, count) ->
				return callback err, null if err

				failureRatio = results.length/count*100.0
				if failureRatio >= failureRate
					findOneAlert channelID, status, dateToCheck, null, 'Completed', (err, alert) ->
						return callback err, null if err
						# Has an alert already been sent this last hour?
						if alert?
							callback err, []
						else
							callback err, results
				else
					callback err, []
		else
			callback err, results


sendAlert = (channelID, status, user, transactions, contactHandler, done) ->
	logger.info "Sending alert for user '#{user.user}' using method '#{user.method}'"

	User.findOne { email: user.user }, (err, dbUser) ->
		return done err if err
		return done "Cannot send alert: Unknown user '#{user.user}'" if not dbUser

		todayStart = moment().startOf('day').toDate()
		findOneAlert channelID, status, todayStart, user.user, 'Completed', (err, alert) ->
			return done err, true if err
			# user already received an alert today, skip
			return done null, true if alert

			if user.method is 'email'
				plainMsg = plainTemplate transactions
				htmlMsg = htmlTemplate transactions
				contactHandler 'email', user.user, 'OpenHIM Alert', plainMsg, htmlMsg, done
			else if user.method is 'sms'
				return done "Cannot send alert: MSISDN not specified for user '#{user.user}'" if not dbUser.msisdn

				smsMsg = smsTemplate transactions
				contactHandler 'sms', dbUser.msisdn, 'OpenHIM Alert', smsMsg, null, done
			else
				return done "Unknown method '#{user.method}' specified for user '#{user.user}'"

sendAlerts = (channelID, alert, transactions, contactHandler, done) ->
	storeAlert = (err, user, done) ->
		alert = new Alert
			user: user.user
			method: user.method
			channelID: channelID
			status: alert.status
			transactions: transactions.map (trx) -> trx._id
			error: err
			alertStatus: if err then 'Failed' else 'Completed'

		alert.save (err) ->
			logger.error err if err
			done()

	alertCallback = (err, user, skipSave, done) ->
		logger.error err if err
		if not skipSave
			storeAlert err, user, done
		else
			done()

	# Crazy tangled nest of async calls and promises
	#
	# Each group check creates one promise that needs to be resolved.
	# For each group, the promise is only resolved when an alert is sent and stored
	# for each user in that group. This resolution is managed by a promise set for that group.
	#
	# For individual users in the alert object (not part of a group),
	# a promise is resolved per user when the alert is both sent and stored.
	promises = []

	if alert.groups
		for group in alert.groups
			groupDefer = Q.defer()
			findGroup group, (err, result) ->
				if err
					logger.error err
					groupDefer.resolve()
				else
					groupUserPromises = []

					for user in result.users
						do (user) ->
							groupUserDefer = Q.defer()
							sendAlert channelID, alert.status, user, transactions, contactHandler, (err, skipSave) ->
								alertCallback err, user, skipSave, -> groupUserDefer.resolve()
							groupUserPromises.push groupUserDefer.promise

					(Q.all groupUserPromises).then -> groupDefer.resolve()
			promises.push groupDefer.promise

	if alert.users
		for user in alert.users
			do (user) ->
				userDefer = Q.defer()
				sendAlert channelID, alert.status, user, transactions, contactHandler, (err, skipSave) ->
					alertCallback err, user, skipSave, -> userDefer.resolve()
				promises.push userDefer.promise

	(Q.all promises).then -> done()


alertingTask = (job, contactHandler, done) ->
	logger.info "Running transaction alerts task"
	job.attrs.data = {} if not job.attrs.data

	lastAlertDate = job.attrs.data.lastAlertDate ? new Date()

	getAllChannels (err, results) ->
		promises = []

		for channel in results
			for alert in channel.alerts
				do (alert) ->
					deferred = Q.defer()

					findTransactionsMatchingStatus channel._id, alert.status, lastAlertDate, alert.failureRate, (err, results) ->
						if err
							logger.error err
							deferred.resolve()
						else if results? and results.length>0
							sendAlerts channel._id, alert, results, contactHandler, -> deferred.resolve()
						else
							deferred.resolve()

					promises.push deferred.promise

		(Q.all promises).then ->
			job.attrs.data.lastAlertDate = new Date()
			done()

setupAgenda = (agenda) ->
	agenda.define 'generate transaction alerts', (job, done) -> alertingTask job, contact.contactUser, done
	agenda.every "#{config.alerts.pollPeriodMinutes} minutes", 'generate transaction alerts'


exports.setupAgenda = setupAgenda

if process.env.NODE_ENV == "test"
	exports.findTransactionsMatchingStatus = findTransactionsMatchingStatus
	exports.alertingTask = alertingTask
	exports.plainTemplate = plainTemplate
	exports.htmlTemplate = htmlTemplate
	exports.smsTemplate = smsTemplate
