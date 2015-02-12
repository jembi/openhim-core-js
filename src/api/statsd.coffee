http = require 'http'
config = require '../config/config'
application = config.get 'application'
os = require "os"
domain = os.hostname() + '.' + application.name
statsd_server = config.get 'statsd'
Q = require "q"
request = require 'koa-request'
_ = require "lodash"
moment = require "moment"
metrics = require "../metrics"
logger = require "winston"
co = require "co"

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
  var filtersObject = this.request.query;
  var userRequesting = this.authenticated,
    path = '',
    results = {},
    final = {};
  allowedIds = allowedIds.length > 0 ? allowedIds : yield metrics.getAllowedChannelIDs(userRequesting)
  var data = []
  var status_array = ['Processing', 'Failed', 'Completed', 'Successful', 'Completed with error(s)']

  for (var j = 0; j < allowedIds.length; j++) {
    var render_url = "/render?target=transformNull(summarize(stats.counters." + domain + ".channels." + allowedIds[j]
    for (i = 0; i < status_array.length; i++) {
      path = render_url + ".statuses." + status_array[i] + ".count,'1day'))&format=json";
      results[status_array[i]] = yield exports.fetchData(path)
      if (results[status_array[i]]) {
        final[status_array[i]] = 'data' in results[status_array[i]] ? results[status_array[i]].data[1][0] : 0;
      } else {
        final[status_array[i]] = 0 ;
      }
    }

    data.push({
      _id: {"channelID": allowedIds[j]},
      failed: final.Failed,
      successful: final.Successful,
      processing: final.Processing,
      completed: final.Completed,
      completedWErrors: final['Completed with error(s)']
    });
  }

  this.body = data
  return data;
}`

exports.retrieveAverageLoadTimePerHour = `function *(type) {

  var path = "/render?target=transformNull(summarize(stats.timers." + domain + ".channels.sum,'1hour','avg'))&from=-1days&format=json";
  var data = [];
  var raw = yield exports.fetchData(path);
  this.body = exports.convertToRequiredFormat(raw, 'retrieveAverageLoadTimePerHour');
  return this.body
}`

exports.retrieveChannelMetrics = `function *(type, channelId) {
  var statusArray = ['Processing', 'Failed', 'Completed', 'Successful', 'Completed with error(s)'];
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
    url: 'http://' + statsd_server.host + path,
    json: true
  };
  var response = yield request(options);
  _.forEach(response.body, function (item, i) {
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
