Transaction = require('./model/transactions').Transaction
Channel = require('./model/channels').Channel
moment = require 'moment'
logger = require 'winston'
mongoose = require 'mongoose'
authorisation = require './api/authorisation'
Q = require 'q'

exports.fetchGlobalLoadTimeMetrics = `function *fetchGlobalLoadTimeMetrics(requestingUser, filtersObject){

  var from, to, body
	var data = {};

  if (filtersObject.startDate && filtersObject.endDate){
    from = new Date(JSON.parse(filtersObject.startDate));
    to = new Date(JSON.parse(filtersObject.endDate));
  } else {
    from =  moment().subtract(1,'weeks').toDate();
    to =  moment().toDate();
  }

  if (filtersObject.startDate && filtersObject.endDate) {
    filtersObject['request.timestamp'] = { $lt: to, $gt: from }

    //remove startDate/endDate from objects filter (Not part of filtering and will break filter)
    delete filtersObject.startDate;
    delete filtersObject.endDate;
  }

  var allowedChannels =  yield authorisation.getUserViewableChannels(requestingUser);
  var allowedChannelIDs = [];

  for (var i = 0; i < allowedChannels.length; i++) {
    allowedChannelIDs.push(mongoose.Types.ObjectId(allowedChannels[i]._id));
  }

  filtersObject['channelID'] = { $in : allowedChannelIDs }

  try {
    var results = yield Transaction.aggregate([
      { $match: filtersObject },
      { $group:
        {
          _id: {
            year: {$year: "$request.timestamp"},
            month: {$month: "$request.timestamp"},
            day: {$dayOfMonth: "$request.timestamp"},
            hour: {$hour: "$request.timestamp"}
          },
          load: { $sum: 1 },
          avgResp: {
            $avg: {
              $subtract : ["$response.timestamp","$request.timestamp"]
            }
          }
        }
      }
    ]).exec();



    data.body = []

    for (var i = 0; i < results.length; i++) {
        data.body.push({
          load: results[i].load,
          avgResp: results[i].avgResp,
          timestamp : moment(results[i]._id.year + '-' + results[i]._id.month + '-'+ results[i]._id.day +' '+ results[i]._id.hour, 'YYYY-MM-DD H').format()
      });
    }
  } catch (e) {
    logger.error('Could not get Transactions global metrics: ' + ' via the API: ' + e);
    data.body = e.message;
    data.status = 'internal server error';
  }

  return data;
}`

exports.fetchGlobalStatusMetrics = `function *fetchGlobalStatusMetrics(requestingUser, filtersObject){

  var from, to;
  var data = {};

  var allowedChannels = yield authorisation.getUserViewableChannels(requestingUser);
  var allowedChannelIDs = [];

  for (var i = 0; i < allowedChannels.length; i++) {
    allowedChannelIDs.push(mongoose.Types.ObjectId(allowedChannels[i]._id));
  }

  filtersObject['channelID'] = { $in : allowedChannelIDs }

   if (filtersObject.startDate && filtersObject.endDate){
    from = new Date(JSON.parse(filtersObject.startDate));
    to = new Date(JSON.parse(filtersObject.endDate));
  } else {
    from =  moment().subtract(1,'weeks').toDate();
    to =  moment().toDate();
  }

  try {

    if (filtersObject.startDate && filtersObject.endDate) {
      filtersObject['request.timestamp'] = { $lt: to, $gt: from }

      //remove startDate/endDate from objects filter (Not part of filtering and will break filter)
      delete filtersObject.startDate;
      delete filtersObject.endDate;
    }

    var result = yield Transaction.aggregate([
      { $match: filtersObject },
      {
        $group: {
          _id: {
            channelID: "$channelID"
          },
          failed: {
            $sum: {
              $cond: [{ $eq: ["$status", 'Failed']}, 1, 0]
            }
          },
          successful: {
            $sum: {
              $cond: [{ $eq: ["$status", 'Successful']}, 1, 0]
            }
          },
          processing: {
            $sum: {
              $cond: [{ $eq: ["$status", 'Processing']}, 1, 0]
            }
          },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$status", 'Completed']}, 1, 0]
            }
          },
          completedWErrors: {
            $sum: {
              $cond: [{ $eq: ["$status", 'Completed with error(s)']}, 1, 0]
            }
          }
        }
      }
    ]).exec();

    data.body = result;
  }
  catch (e) {
    logger.error('Could not get Transactions channel by id: ' + ' via the API: ' + e);
    data.body = e.message;
    data.status = 'internal server error';
  }

  return data;
}`

exports.fetchChannelMetrics = `function fetchChannelMetrics(time, channelId,userRequesting,filtersObject) {

	var from, to ;
	var data = {};
	    data.body = [];

	var channelID = mongoose.Types.ObjectId(channelId);

  if (filtersObject.startDate && filtersObject.endDate){
    from = new Date(JSON.parse(filtersObject.startDate));
    to = new Date(JSON.parse(filtersObject.endDate));
  } else {
    from =  moment().subtract(1,'days').toDate();
    to =  moment().toDate();
  }



  filtersObject.channelID = channelID;

  if (filtersObject.startDate && filtersObject.endDate) {
    filtersObject['request.timestamp'] = { $lt: to, $gt: from }

    //remove startDate/endDate from objects filter (Not part of filtering and will break filter)
    delete filtersObject.startDate;
    delete filtersObject.endDate;
   }


  var groupObject = {};
  groupObject._id = {};
  groupObject = {
    _id: {
      year: { $year: "$request.timestamp" },
      month: { $month: "$request.timestamp"}
    },
    load: { $sum: 1},
    avgResp: {
      $avg: {
        $subtract: ["$response.timestamp", "$request.timestamp"]
      }
    }
  };

  switch (time){
    case 'minute':
      groupObject._id.day = { $dayOfMonth :  "$request.timestamp"};
      groupObject._id.hour = { $hour : "$request.timestamp" };
      groupObject._id.minute = { $minute : "$request.timestamp"};
      break;
    case 'hour':
      groupObject._id.day = { $dayOfMonth :  "$request.timestamp"};
      groupObject._id.hour = { $hour : "$request.timestamp" };
      break;
    case 'day':
      groupObject._id.day = { $dayOfMonth :  "$request.timestamp"};
      break;
    case 'week':
      groupObject._id.week ={ $week : "$request.timestamp"};
      break;
    case 'month':

      break;
    case 'year':
      delete groupObject._id.month;
      break;
    case 'status':
      groupObject = {
          _id: {
            channelID: "$channelID"
          },
          failed: {
            $sum: {
              $cond: [{ $eq: ["$status", 'Failed']}, 1, 0]
            }
          },
          successful: {
            $sum: {
              $cond: [{ $eq: ["$status", 'Successful']}, 1, 0]
            }
          },
          processing: {
            $sum: {
              $cond: [{ $eq: ["$status", 'Processing']}, 1, 0]
            }
          },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$status", 'Completed']}, 1, 0]
            }
          },
          completedWErrors: {
            $sum: {
              $cond: [{ $eq: ["$status", 'Completed with error(s)']}, 1, 0]
            }
          }
        }

      break;
    default :
      //do nothng
      break;
  }
  return Transaction.aggregate([
      { $match: filtersObject },
      { $group: groupObject }
      ]).exec()
}`

allowedChannels = (requestingUser) ->
  authorisation.getUserViewableChannels requestingUser
    .then (allowedChannelsArray)->
      # logger.info JSON.stringify allowedChannelsArray
      allowedChannelIDs = [];
      promises = []
      for channel in allowedChannelsArray
        do (channel) ->
          deferred = Q.defer()
          allowedChannelIDs.push
            id : mongoose.Types.ObjectId channel._id
            name : channel.name
          #logger.info "sending reports to :" + requestingUser.email + " channel : " + channel._id

          deferred.resolve()
          promises.push deferred.promise

      (Q.all promises).then ->
        allowedChannelIDs


exports.allowedChannels = allowedChannels
