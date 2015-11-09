http = require 'http'
config = require '../config/config'
application = config.get 'application'
os = require "os"
domain = os.hostname() + '.' + application.name
statsdServer = config.get 'statsd'
Q = require "q"
request = require 'koa-request'
moment = require "moment"
metrics = require "../metrics"
logger = require "winston"
co = require "co"

statusArray = ['Processing', 'Failed', 'Completed', 'Successful', 'Completed with error(s)']

# Overall Metrics

exports.retrieveTransactionCountPerHour = ->

  path = "/render?target=transformNull(summarize(stats.counters.#{domain}.channels.count,'1hour'))&from=-1days&format=json"
  raw = yield exports.fetchData path

  if raw.data?
    this.body = raw.data.map (item) ->
      load: item[0]
      timestamp: moment.unix item[1]
  else
    this.body = []

# Retrives Global Status Metrics from the StatsD API

exports.fetchGlobalStatusMetrics = (allowedIds) ->
  allowedIds = if allowedIds.length > 0 then allowedIds else yield metrics.getAllowedChannelIDs this.authenticated
  data = []
  for channelId in allowedIds
    total = {}
    renderUrl = "/render?target=transformNull(summarize(stats.counters.#{domain}.channels.#{channelId}"

    for statusType in statusArray
      path = "#{renderUrl}.statuses.#{statusType}.count,'1day'))&format=json"
      result = yield exports.fetchData path
      if result and result.data
        total[statusType] = result.data[1][0]
      else
        total[statusType] = 0

    data.push
      _id: channelID: channelId
      failed: total.Failed
      successful: total.Successful
      processing: total.Processing
      completed: total.Completed
      completedWErrors: total['Completed with error(s)']

  return this.body = data

exports.retrieveAverageLoadTimePerHour = (type) ->
  path = "/render?target=transformNull(summarize(stats.timers.#{domain}.channels.sum,'1hour','avg'))&from=-1days&format=json"
  data = []
  raw = yield exports.fetchData path
  this.body = exports.convertToRequiredFormat raw, 'retrieveAverageLoadTimePerHour'
  return this.body

exports.retrieveChannelMetrics = (type, channelId) ->
  renderUrl = "/render?target=transformNull(summarize(stats.counters.#{domain}.channels.#{channelId}"
  path = ''
  total = {}
  if type is 'status'
    for statusType in statusArray
      path = "#{renderUrl}.statuses.#{statusType}.count,'1week'))&format=json"
      result = yield exports.fetchData path
      if result and result.data
        total[statusType] = (result.data[1] or result.data[0])[0]
      else
        total[statusType] = 0

     this.body = [
        _id: {"channelID": channelId}
        failed: total.Failed
        successful: total.Successful
        processing: total.Processing
        completed: total.Completed
        completedWErrors: total['Completed with error(s)']
    ]
    return this.body
  else

    path = "#{renderUrl}.count,'1day'))&from=-7days&format=json"
    path += "&target=transformNull(summarize(stats.timers.#{domain}.channels.#{channelId}.sum,'1day','avg'))"
    raw = yield exports.fetchData path
    return this.body = exports.convertToRequiredFormat raw, 'retrieveChannelMetrics'

exports.retrieveSumOfTransactionsPerPeriod = (period) ->
  path = "/render?target=integral(stats.counters.#{domain}.channels.count)&from=#{period}&format=json"
  this.body = yield fetchData path

exports.transactionsPerChannelPerHour = (period) ->
  path = "/render?target=summarize(stats.counters.#{domain}.channels.count,'1hour')&from=-1days&format=json"
  raw = yield exports.fetchData path
  this.body = exports.convertToRequiredFormat raw, 'transactionsPerChannelPerHour'

fetchData = (path) ->
  data = {}
  options =
    url: "http://#{statsdServer.host + path}"
    json: true

  response = yield request options
  for item, i in response.body
    if i is 0
      data.data = item.datapoints
    else
      data['data' + i] = item.datapoints
  return data

convertToRequiredFormat = (raw, requiredFormat) ->
  if not raw.data
    return []
  switch requiredFormat
    when "retrieveAverageLoadTimePerHour" then return raw.data.map (item) ->
      avgResp: item[0]
      timestamp: moment.unix item[1]

    when "retrieveChannelMetrics", "transactionsPerChannelPerHour" then return raw.data.map (item, i) ->
      load: item[0]
      avgResp: raw.data1[i][0]
      timestamp: moment.unix item[1]

exports.fetchData = fetchData
exports.convertToRequiredFormat = convertToRequiredFormat
exports.timer = this.timer
