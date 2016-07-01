Transaction = require('./model/transactions').Transaction
Channel = require('./model/channels').Channel
moment = require 'moment'
logger = require 'winston'
mongoose = require 'mongoose'
authorisation = require './api/authorisation'
Q = require 'q'

# Fetches allowed Channels
getAllowedChannels = (requestingUser) ->
  authorisation.getUserViewableChannels requestingUser
  .then (allowedChannelsArray)->

    allowedChannelIDs = []
    promises = []

    for channel in allowedChannelsArray
      do (channel) ->
        deferred = Q.defer()
        allowedChannelIDs.push
          _id: channel._id
          name: channel.name
          status: channel.status

        deferred.resolve()
        promises.push deferred.promise

    (Q.all promises).then ->
      allowedChannelIDs

# Fetches allowed Channel IDs
getAllowedChannelIDs = (requestingUser) ->
  authorisation.getUserViewableChannels requestingUser
  .then (allowedChannelsArray)->

    allowedChannelIDs = []
    promises = []

    for channel in allowedChannelsArray
      do (channel) ->
        deferred = Q.defer()
        allowedChannelIDs.push channel._id

        deferred.resolve()
        promises.push deferred.promise

    (Q.all promises).then ->
      allowedChannelIDs

exports.getAllowedChannels = getAllowedChannels
exports.getAllowedChannelIDs = getAllowedChannelIDs

exports.calculateMetrics = (startDate, endDate, transactionFilter, channelIDs, timeSeries, groupByChannels) ->
  if not (startDate instanceof Date) or not (endDate instanceof Date)
    return new Promise (resolve, reject) ->
      reject new Error 'startDate and endDate must be provided and be of type Date'

  match =
    "request.timestamp":
      $lt: endDate
      $gt: startDate
  if transactionFilter
    Object.assign match, transactionFilter

  if channelIDs
    match.channelID =
      $in: channelIDs

  group =
    _id: {}
    total: $sum: 1
    aveResp: $avg: $subtract: [ "$response.timestamp", "$request.timestamp" ]
    minResp: $min: $subtract: [ "$response.timestamp", "$request.timestamp" ]
    maxResp: $max: $subtract: [ "$response.timestamp", "$request.timestamp" ]
    failed: $sum: $cond: [ $eq: [ "$status", "Failed" ], 1, 0 ]
    successful: $sum: $cond: [ $eq: [ "$status", "Successful" ], 1, 0 ]
    processing: $sum: $cond: [ $eq: [ "$status", "Processing" ], 1, 0 ]
    completed: $sum: $cond: [ $eq: [ "$status", "Completed" ], 1, 0 ]
    completedWErrors: $sum: $cond: [ $eq: [ "$status", "Completed with error(s)" ], 1, 0 ]
  if groupByChannels
    group._id.channelID = '$channelID'

  if timeSeries
    switch timeSeries
      when "minute"
        group._id.minute = $minute: "$request.timestamp"
        group._id.hour = $hour: "$request.timestamp"
        group._id.day = $dayOfMonth: "$request.timestamp"
        group._id.week = $week: "$request.timestamp"
        group._id.month = $month: "$request.timestamp"
        group._id.year = $year: "$request.timestamp"
      when "hour"
        group._id.hour = $hour: "$request.timestamp"
        group._id.week = $week: "$request.timestamp"
        group._id.day = $dayOfMonth: "$request.timestamp"
        group._id.month = $month: "$request.timestamp"
        group._id.year = $year: "$request.timestamp"
      when "day"
        group._id.day = $dayOfMonth: "$request.timestamp"
        group._id.week = $week: "$request.timestamp"
        group._id.month = $month: "$request.timestamp"
        group._id.year = $year: "$request.timestamp"
      when "week"
        group._id.week = $week: "$request.timestamp"
        group._id.month = $month: "$request.timestamp"
        group._id.year = $year: "$request.timestamp"
      when "month"
        group._id.month = $month: "$request.timestamp"
        group._id.year = $year: "$request.timestamp"
      when "year"
        group._id.year = $year: "$request.timestamp"

  pipeline = [ { $match: match }, { $group: group } ]
  return Transaction.aggregate(pipeline).exec()
