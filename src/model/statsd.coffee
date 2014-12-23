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
  var raw = yield fetchData(path);

  _.forEach(raw, function (item) {
    data.push({
      load: item[0],
      timestamp: moment.unix(item[1])
    });
  });
  this.body = data
}`

exports.fetcGlobalStatusMetrics = `function *() {
  var filtersObject = this.request.query;
  var userRequesting = this.authenticated;
  var allowedIds = yield metrics.getAllowedChannelIDs(userRequesting)
  var data = []

  for (var i = 0; i < allowedIds.length; i++) {
    var path = "/render?target=transformNull(summarize(stats.counters." + domain + ".Channels." + allowedIds[i] + ".Statuses.*.count,'1week'))&from=-1weeks&format=json";
    var raw = yield fetchData(path);
    var failed = function () {
      if (raw.data[0][0])
        return raw.data[0][0]
      return 0;    }

    var successful = function () {
      if (raw.data1[0][0])
        return raw.data1[0][0]
      return 0;
    }

    data.push({
      _id : {"channelID": allowedIds[i] },
      failed: failed,
      successful: successful,
      processing:0,
      completed:0,
      completedWErrors:0
    })
  }

  this.body = data
}`

exports.retrieveAverageLoadTimePerHour = `function *() {
  var path = "/render?target=transformNull(summarize(stats.timers." + domain + ".Channels.mean,'1hour'))&from=-1days&format=json";
  var data = [];
  var raw = yield fetchData(path);

  _.forEach(raw.data, function (item) {
    data.push({
      avgResp: item[0],
      timestamp: moment.unix(item[1])
    });
  });
  this.body = data
}`

exports.retrieveChannelMetrics = `function *(type, channelId) {
  var data = [];
  var status_array = ['Failed','Successful', 'Completed']
  var render_url = "/render?target=transformNull(summarize(stats.counters." + domain + ".Channels." + channelId

  if (type == 'status'){
    var path = render_url + ".Statuses.*.count,'1week'))&from=-1weeks&format=json";
    var raw = yield fetchData(path);
    var i = 0;
    var failed = function () {
      if (raw.data[0][0])
        return raw.data[0][0]
      return 0;    }

    var successful = function () {
      if (raw.data1[0][0])
        return raw.data1[0][0]
      return 0;
    }
    data.push({
      _id : {"channelID": channelId },
      failed: failed,
      successful: successful,
      processing:0,
      completed:0,
      completedWErrors:0
    });


  } else {

    var path = render_url + ".count,'1day'))&from=-7days&format=json";
        path += "&target=transformNull(summarize(stats.timers." + domain + ".Channels." + channelId + ".sum,'1day','avg'))";
    var raw = yield fetchData(path);
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
  var raw = yield fetchData(path);
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

exports.fetchData = fetchData = `function *(path) {
  var options = {
    url: 'http://' + statsd_server.host + path
  };
  var response = yield request(options);
  var info = JSON.parse(response.body);
  var data = {};
  var i = 0;

  _.forEach(info, function (item) {
    if (i == 0) {
      data.data = item.datapoints
    } else {
      data['data' + i] = item.datapoints
    }
    i++;
  });

  return data;
}`
