#http://104.236.15.32/render?target=stats.counters.duma-jembi.Development.Channels.54857a41b1a22d590d6bc7ce.zifm.404.count&format=json
#http://104.236.15.32/

http = require 'http'
config = require '../config/config'
application = config.get 'application'
os = require "os"
domain = os.hostname() + '.' + application.name
statsd_server = config.get 'statsd'
Q = require "q"
request = require 'koa-request'


exports.retrieveTransactionCount = `function *() {
  path = '/render?target=summarize(stats.counters.duma-jembi.Development.Channels.54857a41b1a22d590d6bc7ce.count,%221hour%22)&from=-3hours&format=json';
  var options = {
      url: 'http://' + statsd_server.host + path,
      headers: { 'User-Agent': 'request' }
  };
  var response = yield request(options); //Yay, HTTP requests with no callbacks!
  var info = JSON.parse(response.body);
  this.body = info[0].datapoints
};`
