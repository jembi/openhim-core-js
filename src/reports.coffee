Channel = require('./model/channels').Channel
User = require('./model/users').User
logger = require 'winston'
Q = require 'q'
config = require "./config/config"
config.reports = config.get('reports')
contact = require './contact'
metrics = require './metrics'
moment = require "moment"

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

          sendUserEmail report

        done()


sendUserEmail = (report) ->
  contact.contactUser 'email', report.email, report.type + ' report for ' + report.email, plainTemplate(report), htmlTemplate(report), afterEmail


fetchChannelReport = (channel, user, flag, callback) ->
  if flag == 'dailyReport'
    from = moment().startOf('day').toDate()
    to = moment().endOf('day').toDate()
    period = 'day'
  else
    from = moment().startOf('week').toDate()
    to = moment().endOf('week').toDate()
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
#      console.log item
      callback item

fetchDailySubscribers = (callback) ->
  User.find { dailyReport: true }, callback

fetchWeeklySubscribers = (callback) ->
  User.find { weeklyReport: true }, callback

plainTemplate = (report) ->
  text = ''
  for data in report.data
    do (data) ->
      text += " \r\n \r\n <---------- Start Channel  #{data.channel.name} ---------------------------> \r\n \r\n
                Channel Name: #{data.channel.name} \r\n
                Channel Load: #{ data.data[0].load } transactions  \r\n
                Ave response time: #{ data.data[0].avgResp } \r\n
                Failed:  #{ data.statusData[0].failed }  \r\n
                Successful:  #{ data.statusData[0].successful }  \r\n
                Processing: #{ data.statusData[0].processing }  \r\n
                Completed:  #{ data.statusData[0].completed }  \r\n
                Completed with errors: #{ data.statusData[0].completedWErrors } \r\n \r\n
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
      text += "<td> #{ data.data[0].load } transactions </td>"
      text += "<td> #{ data.data[0].avgResp } </td>"
      text += "<td> #{ data.statusData[0].failed }  </td>"
      text += "<td> #{ data.statusData[0].successful }  </td>"
      text += "<td> #{ data.statusData[0].processing }  </td>"
      text += "<td> #{ data.statusData[0].completed }  </td>"
      text += "<td> #{ data.statusData[0].completedWErrors } </td></tr>"
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

  agenda.every "1 weeks", 'send weekly channel metrics'
  agenda.every "1 days", 'send daily channel metrics'

exports.setupAgenda = setupAgenda
exports.sendReports = sendReports
exports.fetchDailySubscribers = fetchDailySubscribers
exports.fetchWeeklySubscribers = fetchWeeklySubscribers
exports.fetchChannelReport = fetchChannelReport
exports.sendUserEmail = sendUserEmail