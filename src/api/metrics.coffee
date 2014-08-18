Transaction = require('../model/transactions').Transaction
moment = require 'moment'
logger = require 'winston'
mongoose = require 'mongoose'

exports.getChannelMetrics = `function *getChannelMetrics(time, channelId) {


  var channelID = mongoose.Types.ObjectId(channelId);
  var filtersObject = this.request.query;
	var from, to
  from = new Date(JSON.parse(filtersObject.startDate));
  to = new Date(JSON.parse(filtersObject.endDate));

  filtersObject.channelID = channelID;
  if (filtersObject.startDate && filtersObject.endDate) {
    filtersObject['request.timestamp'] = {
      $lt: to,
      $gt: from
    }

    //remove startDate/endDate from objects filter (Not part of filtering and will break filter)
    delete filtersObject.startDate;
    delete filtersObject.endDate;
  }


  switch (time) {
    case 'minute':
     try {
        this.body = yield Transaction.aggregate([
          {
            $match: filtersObject
          }
          ,{
            $group: {
              _id: {
                year: {$year: "$request.timestamp"},
                month: {$month: "$request.timestamp"},
                day: {$dayOfMonth: "$request.timestamp"},
                hour: {$hour: "$request.timestamp"},
                minute: {$minute: "$request.timestamp"}
              },
              load: {$sum: 1}
            }
          }
        ]).exec();
      }
      catch (e) {

        logger.error('Could not get Transactions channel by id: ' + ' via the API: ' + e);
        this.body = e.message;
        this.status = 'internal server error';
      }
      break;
    case 'hour':
       try {
        this.body = yield Transaction.aggregate([
          {
            $match: filtersObject
          }
          ,{
            $group: {
              _id: {
                year: {$year: "$request.timestamp"},
                month: {$month: "$request.timestamp"},
                day: {$dayOfMonth: "$request.timestamp"},
                hour: {$hour: "$request.timestamp"}
              },
              load: {$sum: 1},
              avgResp: {
                $avg: {
                    $subtract : ["$request.timestamp","$response.timestamp"]
                }
              }

            }
          }
        ]).exec();
      }
      catch (e) {

        logger.error('Could not get Transactions channel by id: ' + ' via the API: ' + e);
        this.body = e.message;
        this.status = 'internal server error';
      }
      break;
    case 'day':

      try {
        this.body = yield Transaction.aggregate([
          {
            $match: filtersObject
          }
          ,{
            $group: {
              _id: {
                year: {$year: "$request.timestamp"},
                month: {$month: "$request.timestamp"},
                day: {$dayOfMonth: "$request.timestamp"}

              },
              load: {
                $sum: 1
              },
              avgResp: {
                $avg: {
                    $subtract : ["$response.timestamp","$request.timestamp"]
                }
              }
            }
          }
        ]).exec();
      }
      catch (e) {

        logger.error('Could not get Transactions channel by id: ' + ' via the API: ' + e);
        this.body = e.message;
        this.status = 'internal server error';
      }
      break;
    case 'week':
       try {
        this.body = yield Transaction.aggregate([
          {
            $match: filtersObject
          }
          ,{
            $group: {
              _id: {
                year: {$year: "$request.timestamp"},
                month: {$month: "$request.timestamp"},
                week: {$week: "$request.timestamp"}

              },
              load: {$sum: 1}
            }
          }
        ]).exec();
      }
      catch (e) {

        logger.error('Could not get Transactions channel by id: ' + ' via the API: ' + e);
        this.body = e.message;
        this.status = 'internal server error';
      }
      break;
    case 'month':
       try {
        this.body = yield Transaction.aggregate([
          {
            $match: filtersObject
          }
          ,{
            $group: {
              _id: {
                year: {$year: "$request.timestamp"},
                month: {$month: "$request.timestamp"}

              },
              load: {$sum: 1}
            }
          }
        ]).exec();
      }
      catch (e) {

        logger.error('Could not get metrics channel by id: ' + ' via the API: ' + e);
        this.body = e.message;
        this.status = 'internal server error';
      }
      break;
    case 'status':
    try {
        this.body = yield Transaction.aggregate([
          {
            $match: filtersObject
          }
          ,{
            $group: {
              _id: {
                status: "$status"
              },
              load: {$sum: 1}
            }
          }
        ]).exec();
      }
      catch (e) {

        logger.error('Could not get Transactions channel by id: ' + ' via the API: ' + e);
        this.body = e.message;
        this.status = 'internal server error';
      }

      break;
      default :
      //do nothing
  }

}`;

exports.getTranstactionStatusMetrics = `function *getTranstactionStatusMetrics() {
    try {
      var filtersObject = this.request.query;
      var from, to
      from = new Date(JSON.parse(filtersObject.startDate));
      to = new Date(JSON.parse(filtersObject.endDate));


      if (filtersObject.startDate && filtersObject.endDate) {
        filtersObject['request.timestamp'] = {
          $lt: to,
          $gt: from
      }

      //remove startDate/endDate from objects filter (Not part of filtering and will break filter)
      delete filtersObject.startDate;
      delete filtersObject.endDate;
    }
    this.body = yield Transaction.aggregate([
      {
        $match: filtersObject
      }
      ,{
        $group: {
          _id: {
            status: "$status",
            channelId : "$channelID"
          },
          transaction_count: {$sum: 1}
        }
      }
    ]).exec();
  }
  catch (e) {

  logger.error('Could not get Transactions channel by id: ' + ' via the API: ' + e);
  this.body = e.message;
  this.status = 'internal server error';
  }
}
`

exports.getGlobalMetrics = `function *getGlobalMetrics() {
var filtersObject = this.request.query;
	var from, to
  from = new Date(JSON.parse(filtersObject.startDate));
  to = new Date(JSON.parse(filtersObject.endDate));


  if (filtersObject.startDate && filtersObject.endDate) {
    filtersObject['request.timestamp'] = {
      $lt: to,
      $gt: from
    }

    //remove startDate/endDate from objects filter (Not part of filtering and will break filter)
    delete filtersObject.startDate;
    delete filtersObject.endDate;
  }

  try {
        this.body = yield Transaction.aggregate([
          {
            $match: filtersObject
          }
          ,{
            $group: {
              _id: {
                year: {$year: "$request.timestamp"},
                month: {$month: "$request.timestamp"},
                day: {$dayOfMonth: "$request.timestamp"},
                hour: {$hour: "$request.timestamp"}


              },
              load: {
                $sum: 1
              },
              avgResp: {
                $avg: {
                    $subtract : ["$response.timestamp","$request.timestamp"]
                }
              }
            }
          }
        ]).exec();
  } catch (e) {
        logger.error('Could not get Transactions global metrics: ' + ' via the API: ' + e);
        this.body = e.message;
        this.status = 'internal server error';
  }
}`;