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

exports.getGlobalLoadTimeMetrics =  ->
  filtersObject = this.request.query
  userRequesting = this.authenticated
  results = yield metrics.fetchGlobalLoadTimeMetrics userRequesting, filtersObject
  this.body = []

  for result, i in results
    this.body.push
      load: result.load
      avgResp: results[i].avgResp
      timestamp: moment.utc([
        result._id.year
        result._id.month - 1
        result._id.day
        result._id.hour
      ]).format()
  return

################################################################################################
# getGlobalStatusMetrics() function for generating aggregated Transaction Status Metrics #
################################################################################################

exports.getGlobalStatusMetrics = ->
  filtersObject = this.request.query
  userRequesting = this.authenticated
  results = yield metrics.fetchGlobalStatusMetrics userRequesting, filtersObject
  this.body = results
  return

##########################################################################
# getChannelMetrics() function for generating aggregated channel Metrics #
##########################################################################

exports.getChannelMetrics = (time, channelId) ->
  filtersObject = this.request.query
  userRequesting = this.authenticated
  results = yield metrics.fetchChannelMetrics time, channelId, userRequesting, filtersObject
  if time is 'status'
    this.body = results
  else
    this.body = []
    #format the message to show what the console expects

    for result, i in results
      if !result._id.minute
        result._id.minute = '00'
      if !result._id.hour
        result._id.hour = '00'
      if !result._id.day
        result._id.day = '1'
      this.body.push
        load: result.load
        avgResp: result.avgResp
        timestamp: moment.utc([
          result._id.year
          result._id.month - 1
          result._id.day
          result._id.hour
          result._id.minute
        ]).format()

  return
