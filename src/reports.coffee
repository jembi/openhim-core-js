Channel = require('./model/channels').Channel
User = require('./model/users').User
logger = require 'winston'
Q = require 'q'
config = require "./config/config"
config.reports = config.get('reports')
contact = require './contact'
metrics = require './metrics'
moment = require "moment"
config = require "./config/config"
config.reports = config.get('reports')
EmailTemplate = require('email-templates').EmailTemplate
path = require('path')


# Function Sends the reports
sendReports = (job, flag, done) ->
  reportMap = {}
  channelReportMap = {}
  channelMap = {}

  if flag == 'dailyReport'
    from = moment().subtract(1, 'days').startOf('day').toDate()
    to = moment().subtract(1, 'days').endOf('day').toDate()
  else
    from = moment().subtract(1, 'days').startOf('isoWeek').toDate()
    to = moment().subtract(1, 'days').endOf('isoWeek').toDate()

  # Select the right subscribers for the report
  if flag == 'dailyReport'
    fetchUsers = fetchDailySubscribers
  if flag == 'weeklyReport'
    fetchUsers = fetchWeeklySubscribers

  fetchUsers (err, users) ->
    promises = []
    userKey = ''
    userIndex = 0
    usersArray = []
    for user in users
      do (user) ->
        deferred = Q.defer()
        userKey = user.email
        metrics.getAllowedChannels user
        .then (result) ->
          usersArray[userIndex] = user
          usersArray[userIndex].allowedChannels = result
          for channel in usersArray[userIndex].allowedChannels
            channelMap[channel._id] =
              user: user
              channel: channel

          userIndex++
          deferred.resolve()

        promises.push deferred.promise

    # Loop through the enriched user array
    innerPromises = []
    (Q.all promises).then ->
      # Pre-Fetch report data into Channel Map
      for key , obj of channelMap
        innerDeferred = Q.defer()
        do (innerDeferred, key, obj) ->
          fetchChannelReport obj.channel, obj.user, flag, from, to, (item) ->
            channelReportMap[key] = item
            innerDeferred.resolve()

        innerPromises.push innerDeferred.promise

      (Q.all innerPromises).then ->
        for user in usersArray
          userKey = user.email
          for channel in user.allowedChannels
            do (channel) ->
              if (reportMap[userKey])
                # Do nothing since object already exists
              else
                # Create the object
                reportMap[userKey] =
                  email: user.email
                  data: []

              # If report has been fetched get it from the map
              if channelReportMap[channel._id]
                data = channelReportMap[channel._id]
                # add report - always add if the channel is enabled (treating undefined status as enabled), otherwise only if there is data
                if not data.channel.status? or data.channel.status is 'enabled' or data.data.length isnt 0
                  reportMap[userKey].data.push data
              else
                logger.info 'should never be here since channels have been pre-fetched'

        # Iterate over reports and send the emails
        for key, report of reportMap
          if flag == 'dailyReport'
            report.isDaily = true
          else
            report.isDaily = false

          report.instance = config.alerts.himInstance
          report.consoleURL = config.alerts.consoleURL

          report.from = moment(from).format 'YYYY-MM-DD'
          report.to = moment(to).format 'YYYY-MM-DD'

          try
            for data, i in report.data
              do (data) ->
                colorGrey = 'color: grey;'
                rowColor = 'background-color: #d9ead3'
                if i % 2
                  rowColor = 'background-color: #b6d7a8;'

                report.data[i].load = (if data.data[0]?.load? then data.data[0].load else 0)
                report.data[i].avgResp = (if data.data[0]?.avgResp? then Math.round(data.data[0].avgResp) else 0)
                report.data[i].failed = (if data.statusData[0]?.failed? then data.statusData[0].failed else 0)
                report.data[i].successful = (if data.statusData[0]?.successful? then data.statusData[0].successful else 0)
                report.data[i].processing = (if data.statusData[0]?.processing? then data.statusData[0].processing else 0)
                report.data[i].completed = (if data.statusData[0]?.completed? then data.statusData[0].completed else 0)
                report.data[i].completedWErrors = (if data.statusData[0]?.completedWErrors? then data.statusData[0].completedWErrors else 0)
                report.data[i].loadStyle = (if report.data[i].load > 0 then '' else colorGrey)
                report.data[i].avgRespStyle = (if report.data[i].avgResp > 0 then '' else colorGrey)
                report.data[i].failedStyle = (if report.data[i].failed > 0 then 'color: red;' else colorGrey)
                report.data[i].successfulStyle = (if report.data[i].successful > 0 then '' else colorGrey)
                report.data[i].processingStyle = (if report.data[i].processing > 0 then '' else colorGrey)
                report.data[i].completedStyle = (if report.data[i].completed > 0 then 'color: orange;' else colorGrey)
                report.data[i].completedWErrorsStyle = (if report.data[i].completedWErrors > 0 then 'color: orangered;' else colorGrey)
                report.data[i].rowColor = rowColor


            sendUserEmail report
          catch err
            logger.error err
            job.fail "Failed to send report reason: #{err}"

        done()


sendUserEmail = (report) ->
  report.date = new Date().toString()
  renderTemplate 'report', report, (reportHtml) ->
    contact.contactUser 'email', report.email, report.type + ' report for: ' + report.instance, plainTemplate(report), reportHtml, afterEmail


fetchChannelReport = (channel, user, flag, from, to, callback) ->
  if flag == 'dailyReport'
    period = 'day'
  else
    period = 'week'

  item = {}

  logger.info 'fetching ' + flag + ' for #' + channel.name + ' ' + user.email + ' ' + channel._id
  metrics.fetchChannelMetrics period, channel._id, user,
    startDate: from
    endDate: to

  .then (data) ->
    item.channel = channel
    item.data = data
    #Then fetch status metrics

    metrics.fetchChannelMetrics 'status', channel._id, user,
      startDate: from
      endDate: to

    .then (statusData) ->
      item.statusData = statusData
      callback item

fetchDailySubscribers = (callback) ->
  User.find { dailyReport: true }, callback

fetchWeeklySubscribers = (callback) ->
  User.find { weeklyReport: true }, callback

plainTemplate = (report) ->
  text = "Generated on: #{new Date().toString()}"
  for data in report.data
    do (data) ->
      text += " \r\n \r\n <---------- Start Channel  #{data.channel.name} ---------------------------> \r\n \r\n
                Channel Name: #{data.channel.name} \r\n
                Channel Load: #{ if data.data[0]?.load? then data.data[0].load else 0} transactions  \r\n
                Ave response time: #{ if data.data[0]?.avgResp? then data.data[0].avgResp  else 0 } \r\n
                Failed:  #{ if data.statusData[0]?.failed? then data.statusData[0].failed  else 0 }  \r\n
                Successful:  #{ if data.statusData[0]?.successful? then data.statusData[0].successful  else 0 }  \r\n
                Processing: #{ if data.statusData[0]?.processing? then data.statusData[0].processing  else 0 }  \r\n
                Completed:  #{ if data.statusData[0]?.completed? then data.statusData[0].completed  else 0 }  \r\n
                Completed with errors: #{ if data.statusData[0]?.completedWErrors? then data.statusData[0].completedWErrors else 0 } \r\n \r\n
                <---------- End Channel -------------------------------------------------> \r\n \r\n
              \r\n
              \r\n
            "
  text

renderTemplate = (templateName, templateData, callback) ->
  templateDir = "#{appRoot}/templates/#{templateName}"
  template = new EmailTemplate(templateDir)
  template.render templateData, (err, result) ->
    if err
      logger.err err
    callback result.html.toString()


afterEmail = (callback) ->
  logger.info 'email sent..'


setupAgenda = (agenda) ->
  agenda.define 'send weekly channel metrics', (job, done) ->
    sendReports job, 'weeklyReport', done

  agenda.define 'send daily channel metrics', (job, done) ->
    sendReports job, 'dailyReport', done

  agenda.every config.reports.weeklyReportAt, 'send weekly channel metrics'
  agenda.every config.reports.dailyReportAt, 'send daily channel metrics'


exports.setupAgenda = setupAgenda

if process.env.NODE_ENV == "test"
  exports.sendReports = sendReports
  exports.fetchDailySubscribers = fetchDailySubscribers
  exports.fetchWeeklySubscribers = fetchWeeklySubscribers
  exports.fetchChannelReport = fetchChannelReport
  exports.sendUserEmail = sendUserEmail
