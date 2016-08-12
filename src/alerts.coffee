config = require "./config/config"
config.alerts = config.get('alerts')
logger = require "winston"
contact = require './contact'
moment = require 'moment'
Q = require 'q'
Channels = require('./model/channels')
Channel = Channels.Channel
Event = require('./model/events').Event
ContactGroup = require('./model/contactGroups').ContactGroup
Alert = require('./model/alerts').Alert
User = require('./model/users').User
authorisation = require('./middleware/authorisation')
utils = require './utils'


trxURL = (trx) -> "#{config.alerts.consoleURL}/#/transactions/#{trx._id}"

statusPlainTemplate = (transactions, channel, alert) ->
  """
  OpenHIM Transactions Alert

  The following transaction(s) have completed with status #{alert.status} on the OpenHIM instance running on #{config.alerts.himInstance}:
  Channel - #{channel.name}
  #{(transactions.map (trx) -> trxURL trx).join '\n'}

  """

statusHtmlTemplate = (transactions, channel, alert) ->
  text = """
    <html>
      <head></head>
      <body>
        <h1>OpenHIM Transactions Alert</h1>
        <div>
          <p>The following transaction(s) have completed with status <b>#{alert.status}</b> on the OpenHIM instance running on <b>#{config.alerts.himInstance}</b>:</p>
          <table>
            <tr><td>Channel - <b>#{channel.name}</b></td></td>\n
    """
  text += (transactions.map (trx) -> "        <tr><td><a href='#{trxURL trx}'>#{trxURL trx}</a></td></tr>").join '\n'
  text += '\n'
  text += """
          </table>
        </div>
      </body>
    </html>
    """

statusSmsTemplate = (transactions, channel, alert) ->
  text = "Alert - "
  if transactions.length > 1
    text += "#{transactions.length} transactions have"
  else if transactions.length is 1
    text += "1 transaction has"
  else
    text += "no transactions have"

  text += " completed with status #{alert.status} on the OpenHIM running on #{config.alerts.himInstance} (#{channel.name})"


maxRetriesPlainTemplate = (transactions, channel, alert) ->
  """
  OpenHIM Transactions Alert - #{config.alerts.himInstance}

  The following transaction(s) have been retried #{channel.autoRetryMaxAttempts} times, but are still failing:

  Channel - #{channel.name}
  #{(transactions.map (trx) -> trxURL trx).join '\n'}

  Please note that they will not be retried any further by the OpenHIM automatically.
  """

maxRetriesHtmlTemplate = (transactions, channel, alert) ->
  text = """
    <html>
      <head></head>
      <body>
        <h1>OpenHIM Transactions Alert - #{config.alerts.himInstance}</h1>
        <div>
          <p>The following transaction(s) have been retried #{channel.autoRetryMaxAttempts} times, but are still failing:</p>
          <table>
            <tr><td>Channel - <b>#{channel.name}</b></td></td>\n
    """
  text += (transactions.map (trx) -> "        <tr><td><a href='#{trxURL trx}'>#{trxURL trx}</a></td></tr>").join '\n'
  text += '\n'
  text += """
          </table>
          <p>Please note that they will not be retried any further by the OpenHIM automatically.</p>
        </div>
      </body>
    </html>
    """

maxRetriesSmsTemplate = (transactions, channel, alert) ->
  text = "Alert - "
  if transactions.length > 1
    text += "#{transactions.length} transactions have"
  else if transactions.length is 1
    text += "1 transaction has"

  text += " been retried #{channel.autoRetryMaxAttempts} times but are still failing on the OpenHIM on #{config.alerts.himInstance} (#{channel.name})"


getAllChannels = (callback) -> Channel.find {}, callback

findGroup = (groupID, callback) -> ContactGroup.findOne _id: groupID, callback

findTransactions = (channelID, dateFrom, status, callback) ->
  Event
    .find {
      created: $gte: dateFrom
      channelID: channelID
      event: 'end'
      status: status
    }, { 'transactionID' }
    .hint created: 1
    .exec callback

countTotalTransactionsForChannel = (channelID, dateFrom, callback) ->
  Event.count {
    created: $gte: dateFrom
    channelID: channelID
    event: 'end'
  }, callback

findOneAlert = (channelID, alert, dateFrom, user, alertStatus, callback) ->
  criteria = {
    timestamp: { "$gte": dateFrom }
    channelID: channelID
    condition: alert.condition
    status: if alert.condition is 'auto-retry-max-attempted' then '500' else alert.status
    alertStatus: alertStatus
  }
  criteria.user = user if user
  Alert
    .findOne criteria
    .exec callback


findTransactionsMatchingCondition = (channelID, alert, dateFrom, callback) ->
  if not alert.condition or alert.condition is 'status'
    findTransactionsMatchingStatus channelID, alert, dateFrom, callback
  else if alert.condition is 'auto-retry-max-attempted'
    findTransactionsMaxRetried channelID, alert, dateFrom, callback
  else
    callback new Error "Unsupported condition '#{alert.condition}'"

findTransactionsMatchingStatus = (channelID, alert, dateFrom, callback) ->
  pat = /\dxx/.exec alert.status
  if pat
    statusMatch = "$gte": alert.status[0]*100, "$lt": alert.status[0]*100+100
  else
    statusMatch = alert.status

  dateToCheck = dateFrom
  # check last hour when using failureRate
  dateToCheck = moment().subtract(1, 'hours').toDate() if alert.failureRate?

  findTransactions channelID, dateToCheck, statusMatch, (err, results) ->
    if not err and results? and alert.failureRate?
      # Get count of total transactions and work out failure ratio
      _countStart = new Date()
      countTotalTransactionsForChannel channelID, dateToCheck, (err, count) ->
        logger.debug ".countTotalTransactionsForChannel: #{new Date()-_countStart} ms"

        return callback err, null if err

        failureRatio = results.length/count*100.0
        if failureRatio >= alert.failureRate
          findOneAlert channelID, alert, dateToCheck, null, 'Completed', (err, userAlert) ->
            return callback err, null if err
            # Has an alert already been sent this last hour?
            if userAlert?
              callback err, []
            else
              callback err, utils.uniqArray results
        else
          callback err, []
    else
      callback err, results

findTransactionsMaxRetried = (channelID, alert, dateFrom, callback) ->
  callback()

calcDateFromForUser = (user) ->
  if user.maxAlerts is '1 per hour'
    dateFrom = moment().subtract(1, 'hours').toDate()
  else if user.maxAlerts is '1 per day'
    dateFrom = moment().startOf('day').toDate()
  else
    null

userAlreadyReceivedAlert = (channelID, alert, user, callback) ->
  if not user.maxAlerts or user.maxAlerts is 'no max'
    # user gets all alerts
    callback null, false
  else
    dateFrom = calcDateFromForUser user
    return callback "Unsupported option 'maxAlerts=#{user.maxAlerts}'" if not dateFrom

    findOneAlert channelID, alert, dateFrom, user.user, 'Completed', (err, userAlert) ->
      callback err ? null, if userAlert then true else false

# Setup the list of transactions for alerting.
#
# Fetch earlier transactions if a user is setup with maxAlerts.
# If the user has no maxAlerts limit, then the transactions object is returned as is.
getTransactionsForAlert = (channelID, alert, user, transactions, callback) ->
  if not user.maxAlerts or user.maxAlerts is 'no max'
    callback null, transactions
  else
    dateFrom = calcDateFromForUser user
    return callback "Unsupported option 'maxAlerts=#{user.maxAlerts}'" if not dateFrom

    findTransactionsMatchingCondition channelID, alert, dateFrom, callback

sendAlert = (channel, alert, user, transactions, contactHandler, done) ->
  User.findOne { email: user.user }, (err, dbUser) ->
    return done err if err
    return done "Cannot send alert: Unknown user '#{user.user}'" if not dbUser

    userAlreadyReceivedAlert channel._id, alert, user, (err, received) ->
      return done err, true if err
      return done null, true if received

      logger.info "Sending alert for user '#{user.user}' using method '#{user.method}'"

      getTransactionsForAlert channel._id, alert.status, user, transactions, (err, transactionsForAlert) ->
        if user.method is 'email'
          plainTemplate = statusPlainTemplate
          htmlTemplate = statusHtmlTemplate
          if alert.condition is 'auto-retry-max-attempted'
            plainTemplate = maxRetriesPlainTemplate
            htmlTemplate = maxRetriesHtmlTemplate

          plainMsg = plainTemplate transactionsForAlert, channel, alert
          htmlMsg = htmlTemplate transactionsForAlert, channel, alert
          contactHandler 'email', user.user, 'OpenHIM Alert', plainMsg, htmlMsg, done
        else if user.method is 'sms'
          return done "Cannot send alert: MSISDN not specified for user '#{user.user}'" if not dbUser.msisdn

          smsTemplate = statusSmsTemplate
          if alert.condition is 'auto-retry-max-attempted'
            smsTemplate = maxRetriesSmsTemplate

          smsMsg = smsTemplate transactionsForAlert, channel.name, alert.status
          contactHandler 'sms', dbUser.msisdn, 'OpenHIM Alert', smsMsg, null, done
        else
          return done "Unknown method '#{user.method}' specified for user '#{user.user}'"

# Actions to take after sending an alert
afterSendAlert = (err, channelID, alert, user, transactions, skipSave, done) ->
  logger.error err if err

  if not skipSave
    alert = new Alert
      user: user.user
      method: user.method
      channelID: channelID
      condition: alert.condition
      status: if alert.condition is 'auto-retry-max-attempted' then '500' else alert.status
      alertStatus: if err then 'Failed' else 'Completed'

    alert.save (err) ->
      logger.error err if err
      done()
  else
    done()

sendAlerts = (channel, alert, transactions, contactHandler, done) ->
  # Each group check creates one promise that needs to be resolved.
  # For each group, the promise is only resolved when an alert is sent and stored
  # for each user in that group. This resolution is managed by a promise set for that group.
  #
  # For individual users in the alert object (not part of a group),
  # a promise is resolved per user when the alert is both sent and stored.
  promises = []

  _alertStart = new Date()
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
              sendAlert channel, alert, user, transactions, contactHandler, (err, skipSave) ->
                afterSendAlert err, channel._id, alert, user, transactions, skipSave, -> groupUserDefer.resolve()
              groupUserPromises.push groupUserDefer.promise

          (Q.all groupUserPromises).then -> groupDefer.resolve()
      promises.push groupDefer.promise

  if alert.users
    for user in alert.users
      do (user) ->
        userDefer = Q.defer()
        sendAlert channel, alert, user, transactions, contactHandler, (err, skipSave) ->
          afterSendAlert err, channel._id, alert, user, transactions, skipSave, -> userDefer.resolve()
        promises.push userDefer.promise

  (Q.all promises).then ->
    logger.debug ".sendAlerts: #{new Date()-_alertStart} ms"
    done()


alertingTask = (job, contactHandler, done) ->
  job.attrs.data = {} if not job.attrs.data

  lastAlertDate = job.attrs.data.lastAlertDate ? new Date()

  _taskStart = new Date()
  getAllChannels (err, results) ->
    promises = []

    for channel in results
      if Channels.isChannelEnabled channel

        for alert in channel.alerts
          do (channel, alert) ->
            deferred = Q.defer()

            _findStart = new Date()
            findTransactionsMatchingCondition channel._id, alert, lastAlertDate, (err, results) ->
              logger.debug ".findTransactionsMatchingStatus: #{new Date()-_findStart} ms"

              if err
                logger.error err
                deferred.resolve()
              else if results? and results.length>0
                sendAlerts channel, alert, results, contactHandler, -> deferred.resolve()
              else
                deferred.resolve()

            promises.push deferred.promise

    (Q.all promises).then ->
      job.attrs.data.lastAlertDate = new Date()
      logger.debug "Alerting task total time: #{new Date()-_taskStart} ms"
      done()


setupAgenda = (agenda) ->
  agenda.define 'generate transaction alerts', (job, done) -> alertingTask job, contact.contactUser, done
  agenda.every "#{config.alerts.pollPeriodMinutes} minutes", 'generate transaction alerts'


exports.setupAgenda = setupAgenda

if process.env.NODE_ENV == "test"
  exports.findTransactionsMatchingStatus = findTransactionsMatchingStatus
  exports.alertingTask = alertingTask
