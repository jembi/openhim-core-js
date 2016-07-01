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

exports.getChannelMetrics = (type, channelId) ->
  filtersObject = this.request.query
  userRequesting = this.authenticated
  results = yield metrics.fetchChannelMetrics type, channelId, userRequesting, filtersObject
  if type is 'status'
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

exports.getMetrics = (channelID, timeSeries) ->
  console.log 'In metrics!', channelID, timeSeries
  channels = yield authorisation.getUserViewableChannels this.authenticated
  channelIDs = channels.map (c) -> c._id
  console.log channels.length
  console.log channelIDs
  console.log channelID, timeSeries
  if typeof channelID 'string' and not (channelID in channelIDs)
    console.log 'HERE'
    this.status = 401
    return
  else if typeof channelID 'string'
    channelIDs = [channelID]

  query = this.request.query
  console.log query
  m = yield metrics.calculateMetrics new Date(query.startDate), new Date(query.endDate), null, channelIDs, timeSeries, true
  console.log 'metrics', m

  if m[0]?._id?.year? # if there are time components
    m = m.map (item) ->
      item.timestamp = moment(item._id)
      return item

  console.log 'setting body'
  this.body = m
