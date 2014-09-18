Transaction = require('../model/transactions').Transaction
Channel = require('../model/channels').Channel
moment = require 'moment'
logger = require 'winston'
mongoose = require 'mongoose'
authorisation = require './authorisation'
Q = require 'q'
metrics = require "../metrics"

########################################################################
# getGlobalLoadTimeMetrics() function for generating aggregated global Metrics #
########################################################################

exports.getGlobalLoadTimeMetrics = `function *() {

  var filtersObject = this.request.query;
  var userRequesting = this.authenticated;

  results = yield metrics.fetchGlobalLoadTimeMetrics(userRequesting, filtersObject);
  this.body = []
  logger.info(JSON.stringify(results))
  for (var i = 0; i < results.length; i++) {
        this.body.push({
          load: results[i].load,
          avgResp: results[i].avgResp,
          timestamp : moment(results[i]._id.year + '-' + results[i]._id.month + '-'+ results[i]._id.day +' '+ results[i]._id.hour, 'YYYY-MM-DD H').format()
      });
    }

}`

################################################################################################
# getGlobalStatusMetrics() function for generating aggregated Transaction Status Metrics #
################################################################################################

exports.getGlobalStatusMetrics = `function *() {

  var filtersObject = this.request.query;
	var userRequesting = this.authenticated;

	results = yield metrics.fetchGlobalStatusMetrics(userRequesting, filtersObject);
  this.body = results

}`

##########################################################################
# getChannelMetrics() function for generating aggregated channel Metrics #
##########################################################################

exports.getChannelMetrics = `function *(time, channelId) {

  var filtersObject = this.request.query;
  var userRequesting = this.authenticated;

	results = yield metrics.fetchChannelMetrics(time, channelId,userRequesting,filtersObject);

  if (time == 'status') {
    this.body = results;
  } else {
    this.body = [];
   //format the message to show what the console expects
    for (var i = 0; i < results.length; i++) {
      if (!results[i]._id.minute) {
        results[i]._id.minute = '00'
      }
      if (!results[i]._id.hour) {
        results[i]._id.hour = '00'
        }
    if (!results[i]._id.day) {
      results[i]._id.day = '1'
    }

    this.body.push({
      load: results[i].load,
      avgResp: results[i].avgResp,
      timestamp: moment(results[i]._id.year + '-' + results[i]._id.month + '-' + results[i]._id.day + ' ' + results[i]._id.hour + ':' + results[i]._id.minute, 'YYYY-MM-DD H:mm').format()
    });
  }
  }
}`;
