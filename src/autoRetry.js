// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import logger from "winston";
import moment from 'moment';
import Q from 'q';
import Channels from './model/channels';
let { Channel } = Channels;
import { AutoRetry } from './model/autoRetry';
import { Task } from './model/tasks';

export function reachedMaxAttempts(tx, channel) {
  return (channel.autoRetryMaxAttempts != null) &&
  (channel.autoRetryMaxAttempts > 0) &&
  (tx.autoRetryAttempt >= channel.autoRetryMaxAttempts);
}

export function queueForRetry(tx) {
  let retry = new AutoRetry({
    transactionID: tx._id,
    channelID: tx.channelID,
    requestTimestamp: tx.request.timestamp
  });
  return retry.save(function(err) {
    if (err) {
      return logger.error(`Failed to queue transaction ${tx._id} for auto retry: ${err}`);
    }
  });
}

let getChannels = callback => Channel.find({autoRetryEnabled: true, status: 'enabled'}, callback);

let popTransactions = function(channel, callback) {
  let to = moment().subtract(channel.autoRetryPeriodMinutes-1, 'minutes');

  let query = {
    $and: [
        {channelID: channel._id}
      , {
        'requestTimestamp': {
          $lte: to.toDate()
        }
      }
    ]
  };

  logger.debug(`Executing query autoRetry.findAndRemove(${JSON.stringify(query)})`);
  return AutoRetry.find(query, function(err, transactions) {
    if (err) { return callback(err); }
    if (transactions.length === 0) { return callback(null, []); }
    return AutoRetry.remove({_id: {$in: (transactions.map(t => t._id))}}, function(err) {
      if (err) { return callback(err); }
      return callback(null, transactions);
    });
  });
};

let createRerunTask = function(transactionIDs, callback) {
  logger.info(`Rerunning failed transactions: ${transactionIDs}`);
  let task = new Task({
    transactions: (transactionIDs.map(t => ({tid: t})) ),
    totalTransactions: transactionIDs.length,
    remainingTransactions: transactionIDs.length,
    user: 'internal'
  });

  return task.save(function(err) {
    if (err) { logger.error(err); }
    return callback();
  });
};

let autoRetryTask = function(job, done) {
  let _taskStart = new Date();
  let transactionsToRerun = [];

  return getChannels(function(err, results) {
    let promises = [];

    for (let channel of Array.from(results)) {
      (function(channel) {
        let deferred = Q.defer();

        popTransactions(channel, function(err, results) {
          if (err) {
            logger.error(err);
          } else if ((results != null) && (results.length>0)) {
            for (let tid of Array.from((results.map(r => r.transactionID)))) { transactionsToRerun.push(tid); }
          }
          return deferred.resolve();
        });

        return promises.push(deferred.promise);
      })(channel);
    }

    return (Q.all(promises)).then(function() {
      let end = function() {
        logger.debug(`Auto retry task total time: ${new Date()-_taskStart} ms`);
        return done();
      };
      if (transactionsToRerun.length > 0) {
        return createRerunTask(transactionsToRerun, end);
      } else { return end(); }
    });
  });
};


let setupAgenda = function(agenda) {
  agenda.define('auto retry failed transactions', (job, done) => autoRetryTask(job, done));
  return agenda.every('1 minutes', 'auto retry failed transactions');
};


export { setupAgenda };

if (process.env.NODE_ENV === "test") {
  exports.getChannels = getChannels;
  exports.popTransactions = popTransactions;
  exports.createRerunTask = createRerunTask;
  exports.autoRetryTask = autoRetryTask;
}
