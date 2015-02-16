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
  results = yield metrics.fetchGlobalLoadTimeMetrics(userRequesting, filtersObject)
  this.body = []
  i = 0
  while i < results.length
    this.body.push
      load: results[i].load
      avgResp: results[i].avgResp
      timestamp: moment.utc([
        results[i]._id.year
        results[i]._id.month - 1
        results[i]._id.day
        results[i]._id.hour
      ]).format()
    i++
  return

################################################################################################
# getGlobalStatusMetrics() function for generating aggregated Transaction Status Metrics #
################################################################################################

exports.getGlobalStatusMetrics = ->
  filtersObject = this.request.query
  userRequesting = this.authenticated
  results = yield metrics.fetchGlobalStatusMetrics(userRequesting, filtersObject)
  this.body = results
  return

##########################################################################
# getChannelMetrics() function for generating aggregated channel Metrics #
##########################################################################

exports.getChannelMetrics = (time, channelId) ->
  filtersObject = this.request.query
  userRequesting = this.authenticated
  results = yield metrics.fetchChannelMetrics(time, channelId, userRequesting, filtersObject)
  if time == 'status'
    this.body = results
  else
    this.body = []
    #format the message to show what the console expects
    i = 0
    while i < results.length
      if !results[i]._id.minute
        results[i]._id.minute = '00'
      if !results[i]._id.hour
        results[i]._id.hour = '00'
      if !results[i]._id.day
        results[i]._id.day = '1'
      this.body.push
        load: results[i].load
        avgResp: results[i].avgResp
        timestamp: moment.utc([
          results[i]._id.year
          results[i]._id.month - 1
          results[i]._id.day
          results[i]._id.hour
          results[i]._id.minute
        ]).format()
      i++
  return
