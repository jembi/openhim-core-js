import Q from "q";
import logger from "winston";
import SDC from "statsd-client";
import os from "os";
import { Transaction } from "../model/transactions";
import { Task } from "../model/tasks";
import { config } from "../config";

const statsdServer = config.get("statsd");
const application = config.get("application");

const domain = `${os.hostname()}.${application.name}.appMetrics`;
const sdc = new SDC(statsdServer);

export function setAttemptNumber(ctx, done) {
	return Transaction.findOne({ _id: ctx.parentID }, (err, transaction) => {
		if (transaction.autoRetry) {
			if (transaction.autoRetryAttempt != null) {
				ctx.currentAttempt = transaction.autoRetryAttempt + 1;
			} else {
				ctx.currentAttempt = 1;
			}
		}
		return transaction.save((err, tx) => {
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
	return Transaction.findOne({ _id: ctx.parentID }, (err, transaction) => {
		transaction.childIDs.push(ctx.transactionId);
		transaction.wasRerun = true;

		return transaction.save((err, tx) => {
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
	return Task.findOne({ _id: ctx.taskID }, (err, task) => {
		task.transactions.forEach((tx) => {
			if (tx.tid === ctx.parentID) {
				tx.rerunID = ctx.transactionId;
				return tx.rerunStatus = ctx.transactionStatus;
			}
		});

		return task.save((err, task) => {
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
export function* koaMiddleware(next) {
	let startTime;
	if (statsdServer.enabled) { startTime = new Date(); }
	const setAttempt = Q.denodeify(setAttemptNumber);
	yield setAttempt(this);
	if (statsdServer.enabled) { sdc.timing(`${domain}.rerunUpdateTransactionMiddleware.setAttemptNumber`, startTime); }

	// do intial yield for koa to come back to this function with updated ctx object
	yield next;
	if (statsdServer.enabled) { startTime = new Date(); }
	const _updateOriginalTransaction = Q.denodeify(updateOriginalTransaction);
	yield _updateOriginalTransaction(this);

	const _updateTask = Q.denodeify(updateTask);
	yield _updateTask(this);
	if (statsdServer.enabled) {
		sdc.timing(`${domain}.rerunUpdateTransactionMiddleware`, startTime);
	}
}
