// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import Q from "q";
import { Transaction } from "../model/transactions";
import { Task } from "../model/tasks";
import logger from "winston";

import config from '../config/config';
let statsdServer = config.get('statsd');
let application = config.get('application');
import SDC from "statsd-client";
import os from "os";

let domain = `${os.hostname()}.${application.name}.appMetrics`;
let sdc = new SDC(statsdServer);

export function setAttemptNumber(ctx, done) {
  return Transaction.findOne({ _id: ctx.parentID }, function(err, transaction) {
    if (transaction.autoRetry) {
      if (transaction.autoRetryAttempt != null) {
        ctx.currentAttempt = transaction.autoRetryAttempt + 1;
      } else {
        ctx.currentAttempt = 1;
      }
    }
    return transaction.save(function(err, tx) {
      if (err) {
        logger.error(`Original transaction ${transaction._id} could not be updated: ${err}`);
      } else {
        logger.debug(`Original transaction #${tx._id} Updated successfully with attempt number`);
      }

      return done(null);
    });
  });
}

export function updateOriginalTransaction(ctx, done) {
  return Transaction.findOne({ _id: ctx.parentID }, function(err, transaction) {
    transaction.childIDs.push(ctx.transactionId);
    transaction.wasRerun = true;
    
    return transaction.save(function(err, tx) {
      if (err) {
        logger.error(`Original transaction ${transaction._id} could not be updated: ${err}`);
      } else {
        logger.debug(`Original transaction ${tx._id} - Updated successfully with childID`);
      }

      return done(null, transaction);
    });
  });
}

export function updateTask(ctx, done) {
  return Task.findOne({ _id: ctx.taskID }, function(err, task) {
    task.transactions.forEach(function(tx) {
      if (tx.tid === ctx.parentID) {
        tx.rerunID = ctx.transactionId;
        return tx.rerunStatus = ctx.transactionStatus;
      }
    });

    return task.save(function(err, task) {
      if (err) {
        logger.info(`Rerun Task ${ctx.taskID} could not be updated: ${err}`);
      } else {
        logger.info(`Rerun Task ${ctx.taskID} - Updated successfully with rerun transaction details.`);
      }

      return done(null, task);
    });
  });
}

/*
 * Koa middleware for updating original transaction with childID
 */
export function koaMiddleware(next) {
  let startTime;
  if (statsdServer.enabled) { startTime = new Date(); }
  let setAttemptNumber = Q.denodeify(exports.setAttemptNumber);
  ({}); //TODO:Fix yield setAttemptNumber this
  if (statsdServer.enabled) { sdc.timing(`${domain}.rerunUpdateTransactionMiddleware.setAttemptNumber`, startTime); }

  // do intial {} #TODO:Fix yield for koa to come back to this function with updated ctx object
  ({}); //TODO:Fix yield next
  if (statsdServer.enabled) { startTime = new Date(); }
  let updateOriginalTransaction = Q.denodeify(exports.updateOriginalTransaction);
  ({}); //TODO:Fix yield updateOriginalTransaction this

  let updateTask = Q.denodeify(exports.updateTask);
  ({}); //TODO:Fix yield updateTask this
  if (statsdServer.enabled) { return sdc.timing(`${domain}.rerunUpdateTransactionMiddleware`, startTime); }
}
