Transaction = require('../model/transactions').Transaction
moment = require 'moment'

exports.getTransactionsPerUnitOfTime = `function *getTransactionsPerMinute(time) {


		switch (time) {
    case 'minute':
          	try {
							this.body = yield Transaction.aggregate([
								{
									$match: {
										"request.timestamp" : {
												$gt	: moment().subtract('hours', 1).toDate()
										 }
									}
								},
								{
									$group : {
										_id:{
											minute_of_hour : {
												$minute: "$request.timestamp"
											}
										},
										numTransactions: { $sum :1 }
									}
								}
							]).exec();
						}
						catch (e) {

							logger.error('Could not get Transactions channel by id: '+ ' via the API: ' + e);
							this.body = e.message;
							this.status = 'internal server error';
						}
        break;
    case 'hour':
            try {
							this.body = yield Transaction.aggregate([
								{
									$match: {
										"request.timestamp" : {
												$gt	: moment().subtract('days', 1).toDate()
										 }
									}
								},
								{
									$group : {
										_id:{
											$hour: "$request.timestamp"
										},
										numTransactions: { $sum :1 }
									}
								}
							]).exec();
						}
						catch (e) {

							logger.error('Could not get Transactions channel by id: '+ ' via the API: ' + e);
							this.body = e.message;
							this.status = 'internal server error';
						}
        break;
    case 'day':
            try {
							this.body = yield Transaction.aggregate([
								{
									$match: {
										"request.timestamp" : {
												$gt	: moment().subtract('weeks', 1).toDate()
										 }
									}
								},
								{
									$group : {
										_id:{
											$dayOfWeek: "$request.timestamp"
										},
										numTransactions: { $sum :1 }
									}
								}
							]).exec();
						}
						catch (e) {

							logger.error('Could not get Transactions channel by id: '+ ' via the API: ' + e);
							this.body = e.message;
							this.status = 'internal server error';
						}
        break;
    case 'week':
            try {
							this.body = yield Transaction.aggregate([
								{
									$match: {
										"request.timestamp" : {
												$gt	: moment().subtract('years', 1).toDate()
										 }
									}
								},
								{
									$group : {
										_id:{
											$week: "$request.timestamp"
										},
										numTransactions: { $sum :1 }
									}
								}
							]).exec();
						}
						catch (e) {

							logger.error('Could not get Transactions channel by id: '+ ' via the API: ' + e);
							this.body = e.message;
							this.status = 'internal server error';
						}
        break;
    case 'month':
            try {
							this.body = yield Transaction.aggregate([
								{
									$match: {
										"request.timestamp" : {
												$gt	: moment().subtract('years', 1).toDate()
										 }
									}
								},
								{
									$group : {
										_id:{
											$month: "$request.timestamp"
										},
										numTransactions: { $sum :1 }
									}
								}
							]).exec();
						}
						catch (e) {

							logger.error('Could not get Transactions channel by id: '+ ' via the API: ' + e);
							this.body = e.message;
							this.status = 'internal server error';
						}
        break;
    default:
        //do nothing
		}

};`