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

# Function Sends the reports

sendReports = (job, flag, done) ->
  reportMap = {}
  channelReportMap = {}
  channelMap = {}

  #Select the right subscribers for the report
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

#    Loop through the enriched user array
    innerPromises = []
    (Q.all promises).then ->
#     Pre-Fetch report data into Channel Map
      for key , obj of channelMap
        innerDeferred = Q.defer()
        do (innerDeferred, key, obj) ->
          fetchChannelReport obj.channel, obj.user, flag, (item) ->
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
                reportMap[userKey].data.push channelReportMap[channel._id]
              else
                logger.info 'should never be here since channels have been pre-fetched'

#        Iterate over reports and send the emails
        for key, report of reportMap
          if flag == 'dailyReport'
            report.type = 'Daily'
          else
            report.type = 'Weekly'
          try
            sendUserEmail report
          catch err
            logger.error err
            job.fail "Failed to send report reason: #{err}"

        done()


sendUserEmail = (report) ->
  contact.contactUser 'email', report.email, report.type + ' report for ' + report.email, plainTemplate(report), htmlTemplate(report), afterEmail


fetchChannelReport = (channel, user, flag, callback) ->
  if flag == 'dailyReport'
    from = moment().subtract(1, 'days').startOf('day').toDate()
    to = moment().subtract(1, 'days').endOf('day').toDate()
    period = 'day'
  else
    from = moment().subtract(1, 'days').startOf('isoWeek').toDate()
    to = moment().subtract(1, 'days').endOf('isoWeek').toDate()
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

htmlTemplate = (report) ->
  text = "
    <html>
    <head></head>
    <body>
    <h1>#{report.type} OpenHIM Transactions Summary</h1>
    <div>
    <p>on the OpenHIM instance running on <b>#{config.alerts.himInstance}</b>:</p>
    <p><span>Generated on: #{new Date().toString()}</span></p>
    <table>
    <tr>
      <th>Channel Name</th>
      <th>Channel Load</th>
      <th>Ave response time</th>
      <th>Failed</th>
      <th>Successful</th>
      <th>Processing</th>
      <th>Completed</th>
      <th>Completed with errors</th>
    </tr>
        "
  for data in report.data
    do (data) ->
      text += "<tr><td><i>#{data.channel.name}</i></td>"
      text += "<td> #{ if data.data[0]?.load? then data.data[0].load else 0 } transactions </td>"
      text += "<td> #{ if data.data[0]?.avgResp? then data.data[0].avgResp else 0 } </td>"
      text += "<td> #{ if data.statusData[0]?.failed? then data.statusData[0].failed else 0 }  </td>"
      text += "<td> #{ if data.statusData[0]?.successful? then data.statusData[0].successful else 0 }  </td>"
      text += "<td> #{ if data.statusData[0]?.processing? then data.statusData[0].processing else 0 }  </td>"
      text += "<td> #{ if data.statusData[0]?.completed? then data.statusData[0].completed else 0 }  </td>"
      text += "<td> #{ if data.statusData[0]?.completedWErrors? then data.statusData[0].completedWErrors else 0 } </td></tr>"
  text += "
    </table>
    </div>
    </body>
    </html>
    "
  text


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
