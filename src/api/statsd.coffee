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

# Overall Metrics

exports.retrieveTransactionCountPerHour = `function *() {

  var path = "/render?target=transformNull(summarize(stats.counters." + domain + ".channels.count,'1hour'))&from=-1days&format=json";
  var data = [];
  var raw = yield exports.fetchData(path);

  _.forEach(raw.data, function (item) {
    data.push({
      load: item[0],
      timestamp: moment.unix(item[1])
    });
  });
  this.body = data
}`

# Retrives Global Status Metrics from the StatsD API

exports.fetcGlobalStatusMetrics = `function *(allowedIds) {
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
      path = render_url + ".statuses." + status_array[i] + ".count,'1week'))&from=-1days&format=json";
      results[status_array[i]] = yield exports.fetchData(path);
      final[status_array[i]] = 'data' in results[status_array[i]] ? results[status_array[i]].data[0][0] : 0;

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
}`

exports.retrieveAverageLoadTimePerHour = `function *() {

  var path = "/render?target=transformNull(summarize(stats.timers." + domain + ".channels.mean,'1hour'))&from=-1days&format=json";
  var data = [];
  var raw = yield exports.fetchData(path);
  return this.body = exports.convertToRequiredFormat(raw, 'retrieveAverageLoadTimePerHour');
}`

exports.retrieveChannelMetrics = `function *(type, channelId) {
  var data = [];
  var status_array = ['Processing', 'Failed', 'Completed', 'Successful', 'Completed with error(s)']
  var results = {}, path = ''
  var render_url = "/render?target=transformNull(summarize(stats.counters." + domain + ".channels." + channelId
  var statuses = []

  if (type == 'status') {
    for (i = 0; i < status_array.length; i++) {
      path = render_url + ".statuses." + status_array[i] + ".count,'1week'))&from=-1weeks&format=json";
      results[status_array[i]] = yield exports.fetchData(path);
      statuses[status_array[i]] =  'data' in results[status_array[i]] ? results[status_array[i]].data[0][0] + results[status_array[i]].data[1][0] : 0
    }

    data.push({
      _id: {"channelID": channelId},
      processing : statuses[status_array[0]] ,
      failed : statuses[status_array[1]] ,
      completed: statuses[status_array[2]] ,
      successful: statuses[status_array[3]] ,
      completedWErrors: statuses[status_array[4]]
    });


  } else {

    path = render_url + ".count,'1day'))&from=-7days&format=json";
    path += "&target=transformNull(summarize(stats.timers." + domain + ".channels." + channelId + ".sum,'1day','avg'))";
    var raw = yield exports.fetchData(path);
    this.body = exports.convertToRequiredFormat(raw, 'retrieveChannelMetrics');
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
    url: 'http://' + statsd_server.host + path
  };
  var response = yield request(options);
  logger.info('Request to statsd: '+ path);

  var info = JSON.parse(response.body);
  if (info.length) {

    var i = 0;
    _.forEach(info, function (item) {
      if (i == 0) {
        data.data = item.datapoints
      } else {
        data['data' + i] = item.datapoints
      }
      i++;
    });
  }
  return data;
}`

convertToRequiredFormat = (raw, requiredFormat) ->
  data = []
  switch requiredFormat
    when "retrieveAverageLoadTimePerHour" then _.forEach raw.data, (item) ->
      data.push
        load: item[0]
        timestamp: moment.unix item[1]

    when "retrieveChannelMetrics", "transactionsPerChannelPerHour" then _.forEach raw.data, (item) ->
      data.push
        load: item[0]
        avgResp: raw.data1[i][0]
        timestamp: moment.unix item[1]
      i++
  data

exports.fetchData = fetchData
exports.convertToRequiredFormat = convertToRequiredFormat