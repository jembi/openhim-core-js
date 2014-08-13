Transaction = require('../model/transactions').Transaction
moment = require 'moment'
logger = require 'winston'
mongoose = require 'mongoose'

exports.getTransactionsPerUnitOfTime = `function *getTransactionsPerMinute(time, channelId) {


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
            $match: {
              "request.timestamp": {
                $gt: moment().subtract('hours', 1).toDate()
              }
            }
          },
          {
            $group: {
              _id: {
                minute_of_hour: {
                  $minute: "$request.timestamp"
                }
              },
              numTransactions: {$sum: 1}
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
            $match: {
              "request.timestamp": {
                $gt: moment().subtract('days', 1).toDate()
              }
            }
          },
          {
            $group: {
              _id: {
                $hour: "$request.timestamp"
              },
              numTransactions: {$sum: 1}
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

      logger.info(JSON.stringify(filtersObject));
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
    case 'week':
      try {
        this.body = yield Transaction.aggregate([
          {
            $match: {
              "request.timestamp": {
                $gt: moment().subtract('months', 1).toDate()
              }
            }
          },
          {
            $group: {
              _id: {
                "date": "$request.timestamp"
              },
              numTransactions: {$sum: 1}
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
            $match: {
              "request.timestamp": {
                $gt: moment().subtract('years', 1).toDate()
              }
            }
          },
          {
            $group: {
              _id: {
                $month: "$request.timestamp"
              },
              numTransactions: {$sum: 1}
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
    default:
    //do nothing
  }

}
;`