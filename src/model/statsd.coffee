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

# Overall Metrics

exports.retrieveTransactionCountPerHour = `function *() {
    var path = "/render?target=summarize(stats.counters." + domain + ".Channels.count,'1hour')&from=-1days&format=json";
//    path = "/render?target=summarize(stats.counters.OpenHIM-core-js-preprod.Production.Channels.count,'1hour')&from=-1days&format=json";
    var data = [];
    var raw =  yield fetchData(path);

    _.forEach(raw.data, function (item){
        data.push({
          load: item[0],
          timestamp: moment.unix(item[1])
        });
    });
    this.body = data
}`

exports.retrieveAverageLoadTimePerHour = `function *() {
    var path = "/render?target=transformNull(summarize(stats.timers." + domain + ".Channels.mean,'1hour'))&from=-1days&format=json";
//    path = "/render?target=summarize(stats.timers.OpenHIM-core-js-preprod.Production.Channels.sum,'1hour')&from=-1days&format=json";
    var data = [];
    var raw = yield fetchData(path);

    _.forEach(raw.data, function (item){
        data.push({
          avgResp: item[0],
          timestamp: moment.unix(item[1])
        });
    });
    this.body = data
}`

exports.retrieveSumOfTransactionsPerPeriod = `function *(period) {
    var path = '/render?target=integral(stats.counters."+ domain + ".Channels.count)&from=' + period + '&format=json';
    this.body = yield fetchData(path);
}`

exports.transactionsPerChannelPerHour = `function *(period) {
  var path = "/render?target=summarize(stats.counters." + domain + ".Channels.count,'1hour')&from=-1days&format=json";
  path = "/render?target=summarize(stats.counters.OpenHIM-core-js-preprod.Production.Channels.count,'1hour')&from=-1days&format=json";
  var data = [];
  var raw =  yield fetchData(path);

  _.forEach(raw.data, function (item){
      data.push({
        load: item[0],
        timestamp: moment.unix(item[1])
      });
  });
  this.body = data
}`

fetchData =  `function *fetchData(path) {
  var options = {
      url: 'http://' + statsd_server.host + path
  };
  var response = yield request(options);
  var info = JSON.parse(response.body);
  var data = {
    data: info[0].datapoints
  };
  return data;
}`
