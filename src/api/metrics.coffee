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

exports.getGlobalLoadTimeMetrics = `function *getGlobalLoadTimeMetrics() {

  var filtersObject = this.request.query;
  var userRequesting = this.authenticated;

  result = yield metrics.fetchGlobalLoadTimeMetrics(userRequesting, filtersObject);
  this.body = result.body;
}`

################################################################################################
# getGlobalStatusMetrics() function for generating aggregated Transaction Status Metrics #
################################################################################################

exports.getGlobalStatusMetrics = `function *getGlobalStatusMetrics() {

  var filtersObject = this.request.query;
	var userRequesting = this.authenticated;

	result = yield metrics.fetchGlobalStatusMetrics(userRequesting, filtersObject);
  this.body = result.body;

}`

##########################################################################
# getChannelMetrics() function for generating aggregated channel Metrics #
##########################################################################

exports.getChannelMetrics = `function *(time, channelId) {

  var filtersObject = this.request.query;
  var userRequesting = this.authenticated;

	result = yield metrics.fetchChannelMetrics(time, channelId,userRequesting,filtersObject);
  this.body = result.body;

}`;
