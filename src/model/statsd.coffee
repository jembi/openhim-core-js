http = require 'http'
config = require '../config/config'
application = config.get 'application'
os = require "os"
domain = os.hostname() + '.' + application.name
domain = "statsd-VirtualBox.Development"
statsd_server = config.get 'statsd'
Q = require "q"
request = require 'koa-request'
_ = require "lodash"
moment = require "moment"
metrics = require "../metrics"

# Overall Metrics

exports.retrieveTransactionCountPerHour = `function *() {

  var path = "/render?target=transformNull(summarize(stats.counters." + domain + ".Channels.count,'1hour'))&from=-1days&format=json";
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
      results = {};
  var allowedIds = allowedIds.length > 0 ? allowedIds : yield metrics.getAllowedChannelIDs(userRequesting)
  var data = []
  var status_array = ['Successful', 'Failed', 'Completed', 'Processing', 'Completed with error(s)']

  for (var j = 0; j < allowedIds.length; j++) {
      var render_url = "/render?target=transformNull(summarize(stats.counters." + domain + ".Channels." + allowedIds[j]
      for (i = 0; i < status_array.length; i++) {
        path = render_url + ".Statuses." + status_array[i] + ".count,'1week'))&from=-1days&format=json";
        console.log(path);
        results[status_array[i]] = yield exports.fetchData(path);
        console.log(results)
      };
  }

  var failed = 'data' in results.Failed ? results.Failed.data[0][0] + results.Failed.data[1][0] : 0,
      processing = 'data'  in results.Processing ? results.Processing.data[0][0] + results.Processing.data[1][0] : 0,
      completed = 'data' in results.Completed ? results.Completed.data[0][0] + results.Completed.data[1][0] : 0,
      successful = 'data' in  results.Successful ? results.Successful.data[0][0] + results.Successful.data[1][0] : 0,
      completedWErrors = 'data' in results['Completed with error(s)'] ? results['Completed with error(s)'].data[0][0] + results['Completed with error(s)'].data[1][0] : 0;


  data.push({
    _id : {"channelID": allowedIds[j] },
    failed: failed,
    successful: successful,
    processing:processing,
    completed:completed,
    completedWErrors:completedWErrors
  });

  this.body = data
}`

exports.retrieveAverageLoadTimePerHour = `function *() {

  var path = "/render?target=transformNull(summarize(stats.timers." + domain + ".Channels.mean,'1hour'))&from=-1days&format=json";
  var data = [];
  var raw = yield exports.fetchData(path);

  _.forEach(raw.data, function (item) {
    data.push({
      avgResp: item[0],
      timestamp: moment.unix(item[1])
    });
  });

  return this.body = data
}`

exports.retrieveChannelMetrics = `function *(type, channelId) {
  var data = [];
  var status_array = ['Processing', 'Failed', 'Completed', 'Successful', 'Completed with error(s)']
  var results = {}, path = ''
  var render_url = "/render?target=transformNull(summarize(stats.counters." + domain + ".Channels." + channelId

  if (type == 'status'){
    for (i = 0; i < status_array.length; i++) {
      path = render_url + ".Statuses." + status_array[i] + ".count,'1week'))&from=-1weeks&format=json";
      results[status_array[i]] = yield exports.fetchData(path);
    };

    var failed = 'data' in results.Failed ? results.Failed.data[0][0] + results.Failed.data[1][0] : 0,
      processing = 'data'  in results.Processing ? results.Processing.data[0][0] + results.Processing.data[1][0] : 0,
      completed = 'data' in results.Completed ? results.Completed.data[0][0] + results.Completed.data[1][0] : 0,
      successful = 'data' in  results.Successful ? results.Successful.data[0][0] + results.Successful.data[1][0] : 0,
      completedWErrors = 'data' in results['Completed with error(s)'] ? results['Completed with error(s)'].data[0][0] + results['Completed with error(s)'].data[1][0] : 0;


    data.push({
      _id : {"channelID": channelId },
      failed: failed,
      successful: successful,
      processing:processing,
      completed:completed,
      completedWErrors:completedWErrors
    });


  } else {

        path = render_url + ".count,'1day'))&from=-7days&format=json";
        path += "&target=transformNull(summarize(stats.timers." + domain + ".Channels." + channelId + ".sum,'1day','avg'))";
    var raw = yield exports.fetchData(path);
    var i = 0;
    _.forEach(raw.data, function (item) {
      data.push({
        load: item[0],
        avgResp: raw.data1[i][0],
        timestamp: moment.unix(item[1])
      });
      i++;
    });
  }
  this.body = data
}`

exports.retrieveSumOfTransactionsPerPeriod = `function *(period) {
  var path = '/render?target=integral(stats.counters.' + domain + '.Channels.count)&from=' + period + '&format=json';
  this.body = yield fetchData(path);
}`

exports.transactionsPerChannelPerHour = `function *(period) {
  var path = "/render?target=summarize(stats.counters." + domain + ".Channels.count,'1hour')&from=-1days&format=json";
  path = "/render?target=summarize(stats.counters.OpenHIM-core-js-preprod.Production.Channels.count,'1hour')&from=-1days&format=json";
  var data = [];
  var raw = yield exports.fetchData(path);
  var i = 0;
  _.forEach(raw.data, function (item) {
    data.push({
      load: item[0],
      avgResp: raw.data1[i][0],
      timestamp: moment.unix(item[1])
    });
    i++;
  });
  this.body = data
}`


fetchData = `function* fetchData(path) {

    var data = {};
    var options = {
      url: 'http://' + statsd_server.host + path
    };
    var response = yield request(options);

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

exports.fetchData = fetchData
