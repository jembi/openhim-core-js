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

exports.retrieveTransactionCountPerHour = `function *() {

  var path = "/render?target=transformNull(summarize(stats.counters." + domain + ".channels.count,'1hour'))&from=-1days&format=json";
  var raw = yield exports.fetchData(path);

  this.body = raw.data.map(function(item) {
    return {
      load: item[0],
      timestamp: moment.unix(item[1])
    };
  });
}`

# Retrives Global Status Metrics from the StatsD API

exports.fetchGlobalStatusMetrics = `function *(allowedIds) {
  allowedIds = allowedIds.length > 0 ? allowedIds : yield metrics.getAllowedChannelIDs(this.authenticated);

  var data = allowedIds.map(function(channelId) {
    var total = {};
    var renderUrl = '/render?target=transformNull(summarize(stats.counters.' + domain + '.channels.' + channelId;

    statusArray.forEach(co.wrap(function*(statusType) {
      var path = renderUrl + '.statuses.' + statusType + '.count,\'1day\'))&format=json';
      var result = yield exports.fetchData(path);
      if (result && result.data) {
        total[statusType] = result.data[1][0];
      } else {
        total[statusType] = 0;
      }
    }));

    return {
      _id: {channelID: channelId},
      failed: total.Failed,
      successful: total.Successful,
      processing: total.Processing,
      completed: total.Completed,
      completedWErrors: total['Completed with error(s)']
    };
  });

  return this.body = data;
}`

exports.retrieveAverageLoadTimePerHour = `function *(type) {

  var path = "/render?target=transformNull(summarize(stats.timers." + domain + ".channels.sum,'1hour','avg'))&from=-1days&format=json";
  var data = [];
  var raw = yield exports.fetchData(path);
  this.body = exports.convertToRequiredFormat(raw, 'retrieveAverageLoadTimePerHour');
  return this.body
}`

exports.retrieveChannelMetrics = `function *(type, channelId) {
  var renderUrl = "/render?target=transformNull(summarize(stats.counters." + domain + ".channels." + channelId
  var path = '';
  var total = {};
  if (type === 'status') {
    statusArray.forEach(co.wrap(function*(statusType) {
      path = renderUrl + ".statuses." + statusType + ".count,'1week'))&format=json";
      var result = yield exports.fetchData(path);
      if (result && result.data) {
        total[statusType] = result.data[0][0];
      } else {
        total[statusType] = 0;
      }
    }));

    return this.body = [
      {
        _id: {"channelID": channelId},
        failed: total.Failed,
        successful: total.Successful,
        processing: total.Processing,
        completed: total.Completed,
        completedWErrors: total['Completed with error(s)']
      }
    ];
  } else {

    path = renderUrl + ".count,'1day'))&from=-7days&format=json";
    path += "&target=transformNull(summarize(stats.timers." + domain + ".channels." + channelId + ".sum,'1day','avg'))";
    var raw = yield exports.fetchData(path);
    return this.body = exports.convertToRequiredFormat(raw, 'retrieveChannelMetrics');
  }
}`

exports.retrieveSumOfTransactionsPerPeriod = `function *(period) {
  var path = '/render?target=integral(stats.counters.' + domain + '.channels.count)&from=' + period + '&format=json';
  this.body = yield fetchData(path);
}`

exports.transactionsPerChannelPerHour = `function *(period) {
  var path = "/render?target=summarize(stats.counters." + domain + ".channels.count,'1hour')&from=-1days&format=json";
  var raw = yield exports.fetchData(path);
  this.body = exports.convertToRequiredFormat(raw, 'transactionsPerChannelPerHour');
}`


fetchData = `function* fetchData(path) {
  var data = {};
  var options = {
    url: 'http://' + statsdServer.host + path,
    json: true
  };
  var response = yield request(options);
  response.body.forEach(function (item, i) {
      if (i == 0) {
        data.data = item.datapoints
      } else {
        data['data' + i] = item.datapoints
      }
  });
  return data;
}`

convertToRequiredFormat = (raw, requiredFormat) ->
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
