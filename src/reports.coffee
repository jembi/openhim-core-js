Channel = require('./model/channels').Channel
User = require('./model/users').User
logger = require 'winston'
Q = require 'q'
config = require "./config/config"
config.reports = config.get('reports')
contact = require './contact'
metrics = require './metrics'
logger.cli

sendReports = (job, flag, done) ->
  reportMap = []
  if flag == 'dailyReport'
    fetchUsers = fetchDailySubscribers
  if flag == 'weeklyReport'
    fetchUsers = fetchWeeklySubscribers

  fetchUsers (err, users) ->
    promises = []
    userCount = 0
    for user in users
      do (user) ->
        deferred = Q.defer()
        logger.info reportMap
        metrics.getAllowedChannels user
        .then (result) ->
          innerPromises = []
          for channel in result
            do (channel) ->
              innerDeferred = Q.defer()
              fetchChannelReport channel,user, (item) ->
                if (reportMap[userCount])
                  #do nothing
                else
                  #create the object
                  reportMap[userCount] =
                    email: user.email
                    data: []

                reportMap[userCount].data.push item

                innerDeferred.resolve()
              innerPromises.push innerDeferred.promise

          (Q.all innerPromises).then ->
            userCount++
            deferred.resolve()

        promises.push deferred.promise

    (Q.all promises).then ->
#      logger.info JSON.stringify reportMap
      for report in reportMap
        if fetchUsers == fetchDailySubscribers
          report.type = 'Daily'
        else
          report.type = 'Weekly'

        sendUserEmail report

      logger.info "sending user email "
      done()






sendUserEmail = (report) ->
  contact.contactUser 'email', 'duma@eworks.co.zw', report.type + ' report for ' + report.email , plainTemplate(report), htmlTemplate(report) , afterEmail


#TODO refactor function to include status metrics as well as to allow for weekly metrics
fetchChannelReport = (channel,user,callback) ->
  item = {}
  logger.info 'fetching channel report for #' + channel.name + ' ' + user.email + channel.id
  metrics.fetchChannelMetrics 'day',channel.id,user,{}
  .then (data) ->
    item.channel = channel
    item.data = data
    #Then fetch status metrics
    metrics.fetchChannelMetrics 'status',channel.id,user,{}
    .then (statusData) ->
      item.statusData = statusData
      callback item

fetchDailySubscribers = (callback) ->
  User.find { dailyReport: true }, callback

fetchWeeklySubscribers = (callback) ->
  User.find { weeklyReport: true }, callback

plainTemplate = (report) ->
  for data in report.data
    do (data) ->
      "Channel Name : #{ data.channel.name } \r\n
        Channel Load : #{ data.data[0].load } transactions \r\n
        Transaction Average Response : #{ data.data[0].avgResp } \r\n
        \r\n
        \r\n
      "
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
    sendReports job,'weeklyReport', done

  agenda.define 'send daily channel metrics', (job, done) ->
    sendReports job,'dailyReport', done

  agenda.every "5 minutes", 'send weekly channel metrics'
  agenda.every "5 seconds", 'send daily channel metrics'

exports.setupAgenda = setupAgenda

if process.env.NODE_ENV == "test"
  exports.sendReports = sendReports
  exports.fetchDailySubscribers = fetchDailySubscribers
  exports.fetchWeeklySubscribers = fetchWeeklySubscribers
  exports.fetchChannelReport = fetchChannelReport
