Channel = require('./model/channels').Channel
User = require('./model/users').User
logger = require 'winston'
Q = require 'q'
config = require "./config/config"
config.reports = config.get('reports')
contact = require './contact'
metrics = require './metrics'

sendReports = (job, done) ->
  job.attrs.data = {} if not job.attrs.data
  lastAlertDate = job.attrs.data.lastAlertDate ? new Date()

  promises = []
  fetchUsers (err, users) ->
    for user in users
      do (user) ->
        deferred = Q.defer()
        #Fetch user authorized channels
        metrics.getAllowedChannels user
          .then (result) ->
            for channel in result
              do (channel) ->
                fetchChannelReport(channel,user,done)
        deferred.resolve()

        promises.push deferred.promise

  (Q.all promises).then ->
    job.attrs.data.lastAlertDate = new Date()
    done()

fetchChannelReport = (channel,user,done) ->
  logger.info 'fetching channel report for #' + channel.id + ' ' + user.email
  metrics.fetchChannelMetrics 'day',channel.id,user,{}
    .then (data) ->
        contact.contactUser 'email', user.email, 'Report for ' + channel.name , plainTemplate(channel,data), htmlTemplate(channel,data) , afterEmail

fetchUsers = (callback) ->
  User.find {}, callback

plainTemplate = (channel,data) ->"
  Channel Name : #{ channel.name } \r\n
  Channel Load : #{ data[0].load } transactions \r\n
  Transaction Average Response : #{ data[0].avgResp } \r\n 
"
htmlTemplate = (channel,data) ->"
  Channel Name : #{ channel.name } \r\n <br />
  Channel Load : #{ data[0].load } transactions \r\n <br />
  Transaction Average Response : #{ data[0].avgResp } \r\n <br />
"
afterEmail = (callback) ->
  logger.info callback


setupAgenda = (agenda) ->
  agenda.define 'send channel metrics', (job, done) ->
    sendReports job, done
  agenda.every "3 seconds", 'send channel metrics'

exports.setupAgenda = setupAgenda

if process.env.NODE_ENV == "test"
  exports.sendReports = sendReports
  exports.fetchUsers = fetchUsers
