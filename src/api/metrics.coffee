Transaction = require('../model/transactions').Transaction
moment = require 'moment'
logger = require 'winston'
mongoose = require 'mongoose'
authorisation = require './authorisation'


########################################################################
# getGlobalLoadTimeMetrics() function for generating aggregated global Metrics #
########################################################################
exports.getGlobalLoadTimeMetrics = `function *getGlobalLoadTimeMetrics() {

  var filtersObject = this.request.query;
  var from, to
  from = new Date(JSON.parse(filtersObject.startDate));
  to = new Date(JSON.parse(filtersObject.endDate));

  if (filtersObject.startDate && filtersObject.endDate) {
    filtersObject['request.timestamp'] = { $lt: to, $gt: from }

    //remove startDate/endDate from objects filter (Not part of filtering and will break filter)
    delete filtersObject.startDate;
    delete filtersObject.endDate;
  }

  var allowedChannels = yield authorisation.getUserViewableChannels(this.authenticated);
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

    this.body = []

    for (var i = 0; i < results.length; i++) {
      this.body.push({
        load: results[i].load,
        avgResp: results[i].avgResp,
        timestamp : moment(results[i]._id.year + '-' + results[i]._id.month + '-'+ results[i]._id.day +' '+ results[i]._id.hour, 'YYYY-MM-DD H').format()
      });
    }
  } catch (e) {
    logger.error('Could not get Transactions global metrics: ' + ' via the API: ' + e);
    this.body = e.message;
    this.status = 'internal server error';
  }

}`




################################################################################################
# getGlobalStatusMetrics() function for generating aggregated Transaction Status Metrics #
################################################################################################
exports.getGlobalStatusMetrics = `function *getGlobalStatusMetrics() {

  var filtersObject = {};
  var allowedChannels = yield authorisation.getUserViewableChannels(this.authenticated);
  var allowedChannelIDs = [];

  for (var i = 0; i < allowedChannels.length; i++) {
    allowedChannelIDs.push(mongoose.Types.ObjectId(allowedChannels[i]._id));
  }

  filtersObject['channelID'] = { $in : allowedChannelIDs }
  try {
    var filtersObject = this.request.query;
    var from, to
    from = new Date(JSON.parse(filtersObject.startDate));
    to = new Date(JSON.parse(filtersObject.endDate));

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

    this.body = result;
  }
  catch (e) {
    logger.error('Could not get Transactions channel by id: ' + ' via the API: ' + e);
    this.body = e.message;
    this.status = 'internal server error';
  }

}`




##########################################################################
# getChannelMetrics() function for generating aggregated channel Metrics #
##########################################################################
exports.getChannelMetrics = `function *getChannelMetrics(time, channelId) {

  var channelID = mongoose.Types.ObjectId(channelId);
  var filtersObject = this.request.query;
  var from, to
  from = new Date(JSON.parse(filtersObject.startDate));
  to = new Date(JSON.parse(filtersObject.endDate));

  filtersObject.channelID = channelID;
  if (filtersObject.startDate && filtersObject.endDate) {
    filtersObject['request.timestamp'] = { $lt: to,	$gt: from	}

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
      groupObject._id = {};
      groupObject._id = { status : "$status" }
      delete groupObject.avgResp;
      break;
    default :
      //do nothng
      break;
  }

  try {
    var id = unescape(channelId);
    var results = null;
    var accessDenied = false;

    // if admin allow acces to all channels otherwise restrict result set
    if (authorisation.inGroup('admin', this.authenticated) === false) {
      results = yield Channel.findOne({ _id: id, txViewAcl: { $in: this.authenticated.groups } }).exec();
      var adminResult = yield Channel.findById(id).exec();
      if (!!adminResult) {
        accessDenied = true;
      }
    } else {
      var results = yield Transaction.aggregate([{ $match: filtersObject }, { $group: groupObject }]).exec();
    }

    this.body = []

    if (results === null) {
      if (accessDenied) {
        // Channel exists but this user doesn\'t have access
        this.body = "Access denied to channel with Id: '" + id + "'.";
        this.status = 'forbidden';
      } else {
        // Channel not found! So inform the user
        this.body = "We could not find a channel with Id:'" + id + "'.";
        this.status = 'not found';
      }
    } else {
      if (time == 'status') {
        this.body = results;
      } else {
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
    }
  }
  catch (e) {
    logger.error('Could not get Transactions channel by id: ' + ' via the API: ' + e);
    this.body = e.message;
    this.status = 'internal server error';
  }

}`