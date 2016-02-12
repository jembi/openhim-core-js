Transaction = require('./model/transactions').Transaction
Channel = require('./model/channels').Channel
moment = require 'moment'
logger = require 'winston'
mongoose = require 'mongoose'
authorisation = require './api/authorisation'
Q = require 'q'

#################################################
# Fetches allowed Global Load Time Metrics      #
################################################
exports.fetchGlobalLoadTimeMetrics = fetchGlobalLoadTimeMetrics = (requestingUser, filtersObject) ->

  if filtersObject.startDate and filtersObject.endDate
    filtersObject.startDate = filtersObject.startDate.toString().replace(/"/g, '')
    filtersObject.endDate = filtersObject.endDate.toString().replace(/"/g, '')
    from = new Date(filtersObject.startDate)
    to = new Date(filtersObject.endDate)

    delete filtersObject.startDate
    delete filtersObject.endDate

  else
    from = moment().subtract(1, "weeks").toDate()
    to = moment().toDate()
  filtersObject["request.timestamp"] =
    $lt: to
    $gt: from

  getAllowedChannelIDs(requestingUser).then (allowedChannelIDs) ->
    filtersObject["channelID"] = $in: allowedChannelIDs
    Transaction.aggregate([
      {
        $match: filtersObject
      }
      {
        $group:
          _id:
            year:
              $year: "$request.timestamp"

            month:
              $month: "$request.timestamp"

            day:
              $dayOfMonth: "$request.timestamp"

            hour:
              $hour: "$request.timestamp"

          load:
            $sum: 1

          avgResp:
            $avg:
              $subtract: [
                "$response.timestamp"
                "$request.timestamp"
              ]
      }
    ]).exec()


#################################################
# Fetches allowed Global Status Metrics         #
################################################
exports.fetchGlobalStatusMetrics = fetchGlobalStatusMetrics = (requestingUser, filtersObject) ->

  if filtersObject.startDate and filtersObject.endDate
    filtersObject.startDate = filtersObject.startDate.toString().replace(/"/g, '')
    filtersObject.endDate = filtersObject.endDate.toString().replace(/"/g, '')
    from = new Date(filtersObject.startDate)
    to = new Date(filtersObject.endDate)

    #remove startDate/endDate from objects filter (Not part of filtering and will break filter)
    delete filtersObject.startDate
    delete filtersObject.endDate

  else
    from = moment().subtract(1, "weeks").toDate()
    to = moment().toDate()
  filtersObject["request.timestamp"] =
    $lt: to
    $gt: from

  getAllowedChannelIDs(requestingUser).then (allowedChannelIDs) ->
    filtersObject["channelID"] = $in: allowedChannelIDs
    Transaction.aggregate([
      {
        $match: filtersObject
      }
      {
        $group:
          _id:
            channelID: "$channelID"

          failed:
            $sum:
              $cond: [
                {
                  $eq: [
                    "$status"
                    "Failed"
                  ]
                }
                1
                0
              ]

          successful:
            $sum:
              $cond: [
                {
                  $eq: [
                    "$status"
                    "Successful"
                  ]
                }
                1
                0
              ]

          processing:
            $sum:
              $cond: [
                {
                  $eq: [
                    "$status"
                    "Processing"
                  ]
                }
                1
                0
              ]

          completed:
            $sum:
              $cond: [
                {
                  $eq: [
                    "$status"
                    "Completed"
                  ]
                }
                1
                0
              ]

          completedWErrors:
            $sum:
              $cond: [
                {
                  $eq: [
                    "$status"
                    "Completed with error(s)"
                  ]
                }
                1
                0
              ]
      }
    ]).exec()

#################################################
# Fetches allowed Channel Metrics               #
################################################
exports.fetchChannelMetrics = fetchChannelMetrics = (time, channelId, userRequesting, filtersObject) ->

  channelID = mongoose.Types.ObjectId(channelId)
  if filtersObject.startDate and filtersObject.endDate
    filtersObject.startDate = filtersObject.startDate.toString().replace(/"/g, '')
    filtersObject.endDate = filtersObject.endDate.toString().replace(/"/g, '')
    from = new Date(filtersObject.startDate)
    to = new Date(filtersObject.endDate)
  else
    from = moment().startOf('day').toDate()
    to = moment().endOf('day').toDate()

  filtersObject.channelID = channelID


  filtersObject["request.timestamp"] =
    $lt: to
    $gt: from


#  remove startDate/endDate from objects filter (Not part of filtering and will break filter)
  delete filtersObject.startDate
  delete filtersObject.endDate


  groupObject = {}
  groupObject._id = {}
  groupObject =
    _id:
      year:
        $year: "$request.timestamp"

      month:
        $month: "$request.timestamp"

    load:
      $sum: 1

    avgResp:
      $avg:
        $subtract: [
          "$response.timestamp"
          "$request.timestamp"
        ]

  switch time
    when "minute"
      groupObject._id.day = $dayOfMonth: "$request.timestamp"
      groupObject._id.hour = $hour: "$request.timestamp"
      groupObject._id.minute = $minute: "$request.timestamp"
    when "hour"
      groupObject._id.day = $dayOfMonth: "$request.timestamp"
      groupObject._id.hour = $hour: "$request.timestamp"
    when "day"
      groupObject._id.day = $dayOfMonth: "$request.timestamp"
    when "week"
      groupObject._id.week = $week: "$request.timestamp"
    when "month", "year"
      delete groupObject._id.month
    when "status"
      groupObject =
        _id:
          channelID: "$channelID"

        failed:
          $sum:
            $cond: [
              {
                $eq: [
                  "$status"
                  "Failed"
                ]
              }
              1
              0
            ]

        successful:
          $sum:
            $cond: [
              {
                $eq: [
                  "$status"
                  "Successful"
                ]
              }
              1
              0
            ]

        processing:
          $sum:
            $cond: [
              {
                $eq: [
                  "$status"
                  "Processing"
                ]
              }
              1
              0
            ]

        completed:
          $sum:
            $cond: [
              {
                $eq: [
                  "$status"
                  "Completed"
                ]
              }
              1
              0
            ]

        completedWErrors:
          $sum:
            $cond: [
              {
                $eq: [
                  "$status"
                  "Completed with error(s)"
                ]
              }
              1
              0
            ]
    else

    #do nothng
  Transaction.aggregate([
    {
      $match: filtersObject
    }
    {
      $group: groupObject
    }
  ]).exec()

#################################################
# Fetches allowed Channels                      #
################################################

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

#################################################
# Fetches allowed Channel IDs                   #
################################################

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
