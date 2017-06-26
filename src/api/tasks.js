
import Q from "q";
import logger from "winston";
import { Task } from "../model/tasks";
import { Transaction } from "../model/transactions";
import { AutoRetry } from "../model/autoRetry";
import * as Channels from "../model/channels";
import * as authorisation from "./authorisation";
import * as utils from "../utils";

const { Channel } = Channels;

/**
 * Function to check if rerun task creation is valid
 */

function isRerunPermissionsValid(user, transactions, callback) {
    // if 'admin' - set rerun permissions to true
    if (authorisation.inGroup("admin", user) === true) {
        // admin user allowed to rerun any transactions
        return callback(null, true);
    } else {
        return Transaction.distinct("channelID", { _id: { $in: transactions.tids } }, (err, transChannels) =>
            Channel.distinct("_id", { txRerunAcl: { $in: user.groups } }, (err, allowedChannels) => {
                // for each transaction channel found to be rerun
                for (const trx of Array.from(transChannels)) {
                    // assume transaction channnel is not allowed at first
                    let matchFound = false;

                    // for each user allowed channel to be rerun
                    for (const chan of Array.from(allowedChannels)) {
                        if (trx.equals(chan)) { matchFound = true; }
                    }

                    // if one channel not allowed then rerun NOT allowed
                    if (!matchFound) { return callback(null, false); }
                }
                return callback(null, true);
            })
        );
    }
}


/**
 * Retrieves the list of active tasks
 */
export function* getTasks() {
    // Must be admin
    if (!authorisation.inGroup("admin", this.authenticated)) {
        utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to getTasks denied.`, "info");
        return;
    }

    try {
        const filtersObject = this.request.query;

        // get limit and page values
        const { filterLimit } = filtersObject;
        const { filterPage } = filtersObject;

        // determine skip amount
        const filterSkip = filterPage * filterLimit;

        // get filters object
        const filters = JSON.parse(filtersObject.filters);

        // parse date to get it into the correct format for querying
        if (filters.created) {
            filters.created = JSON.parse(filters.created);
        }

        // exclude transactions object from tasks list
        const projectionFiltersObject = { transactions: 0 };

        this.body = yield Task.find({}).exec();

        // execute the query
        return this.body = yield Task
            .find(filters, projectionFiltersObject)
            .skip(filterSkip)
            .limit(parseInt(filterLimit, 10))
            .sort({ created: -1 })
            .exec();
    } catch (err) {
        return utils.logAndSetResponse(this, 500, `Could not fetch all tasks via the API: ${err}`, "error");
    }
}


const areTransactionChannelsValid = (transactions, callback) =>
    Transaction.distinct("channelID", { _id: { $in: transactions.tids } }, (err, trxChannelIDs) => {
        if (err) { return callback(err); }
        return Channel.find({ _id: { $in: trxChannelIDs } }, { status: 1 }, (err, trxChannels) => {
            if (err) { return callback(err); }

            for (const chan of Array.from(trxChannels)) {
                if (!Channels.isChannelEnabled(chan)) {
                    return callback(null, false);
                }
            }
            return callback(null, true);
        });
    })
    ;


/**
 * Creates a new Task
 */
export function* addTask() {
    // Get the values to use
    const transactions = this.request.body;
    try {
        const taskObject = {};
        const transactionsArr = [];
        taskObject.remainingTransactions = transactions.tids.length;
        taskObject.user = this.authenticated.email;

        if (transactions.batchSize != null) {
            if (transactions.batchSize <= 0) {
                return utils.logAndSetResponse(this, 400, "Invalid batch size specified", "info");
            }
            taskObject.batchSize = transactions.batchSize;
        }

        if (transactions.paused) {
            taskObject.status = "Paused";
        }

        // check rerun permission and whether to create the rerun task
        const isRerunPermsValid = Q.denodeify(isRerunPermissionsValid);
        const allowRerunTaskCreation = yield isRerunPermsValid(this.authenticated, transactions);

        // the rerun task may be created
        if (allowRerunTaskCreation === true) {
            const areTrxChannelsValid = Q.denodeify(areTransactionChannelsValid);
            const trxChannelsValid = yield areTrxChannelsValid(transactions);

            if (!trxChannelsValid) {
                utils.logAndSetResponse(this, 400, "Cannot queue task as there are transactions with disabled or deleted channels", "info");
                return;
            }

            for (const tid of Array.from(transactions.tids)) { transactionsArr.push({ tid }); }
            taskObject.transactions = transactionsArr;
            taskObject.totalTransactions = transactionsArr.length;

            const task = new Task(taskObject);
            const result = yield Q.ninvoke(task, "save");

            // All ok! So set the result
            utils.logAndSetResponse(this, 201, `User ${this.authenticated.email} created task with id ${task.id}`, "info");

            // Clear the transactions out of the auto retry queue, in case they're in there
            return AutoRetry.remove({ transactionID: { $in: transactions.tids } }, (err) => { if (err) { return logger.error(err); } });
        } else {
            // rerun task creation not allowed
            return utils.logAndSetResponse(this, 403, "Insufficient permissions prevents this rerun task from being created", "error");
        }
    } catch (error) {
        // Error! So inform the user
        const err = error;
        return utils.logAndSetResponse(this, 500, `Could not add Task via the API: ${err}`, "error");
    }
}


/**
 * Retrieves the details for a specific Task
 */
function buildFilteredTransactionsArray(filters, transactions) {
    // set tempTransactions array to return
    const tempTransactions = [];

    let i = 0;
    while (i < transactions.length) {
        // set filter variable to captured failed filters
        let filtersFailed = false;

        if (filters.tstatus) {
            // if tstatus doesnt equal filter then set filter failed to true
            if (filters.tstatus !== transactions[i].tstatus) {
                filtersFailed = true;
            }
        }

        if (filters.rerunStatus) {
            // if rerunStatus doesnt equal filter then set filter failed to true
            if (filters.rerunStatus !== transactions[i].rerunStatus) {
                filtersFailed = true;
            }
        }

        if (filters.hasErrors) {
            // if hasErrors filter 'yes' but no hasErrors exist then set filter failed to true
            if ((filters.hasErrors === "yes") && !transactions[i].hasErrors) {
                filtersFailed = true;
                // if hasErrors filter 'no' but hasErrors does exist then set filter failed to true
            } else if ((filters.hasErrors === "no") && transactions[i].hasErrors) {
                filtersFailed = true;
            }
        }

        // add transaction if all filters passed successfully
        if (filtersFailed === false) {
            tempTransactions.push(transactions[i]);
        }

        // increment counter
        i++;
    }

    return tempTransactions;
}

export function* getTask(taskId) {
    // Get the values to use
    taskId = unescape(taskId);

    try {
        const filtersObject = this.request.query;

        // get limit and page values
        const { filterLimit } = filtersObject;
        const { filterPage } = filtersObject;

        // determine skip amount
        const filterSkip = filterPage * filterLimit;

        // get filters object
        const filters = JSON.parse(filtersObject.filters);

        const result = yield Task.findById(taskId).lean().exec();
        let tempTransactions = result.transactions;


        // are filters present
        if (Object.keys(filters).length > 0) {
            tempTransactions = buildFilteredTransactionsArray(filters, result.transactions);
        }

        // get new transactions filters length
        const totalFilteredTransactions = tempTransactions.length;

        // assign new transactions filters length to result property
        result.totalFilteredTransactions = totalFilteredTransactions;

        // work out where to slice from and till where
        const sliceFrom = filterSkip;
        const sliceTo = filterSkip + parseInt(filterLimit, 10);

        // slice the transactions array to return only the correct amount of records at the correct index
        result.transactions = tempTransactions.slice(sliceFrom, sliceTo);

        // Test if the result if valid
        if (result === null) {
            // task not found! So inform the user
            return utils.logAndSetResponse(this, 404, `We could not find a Task with this ID: ${taskId}.`, "info");
        } else {
            return this.body = result;
        }
        // All ok! So set the result
    } catch (err) {
        return utils.logAndSetResponse(this, 500, `Could not fetch Task by ID {taskId} via the API: ${err}`, "error");
    }
}


/**
 * Updates the details for a specific Task
 */
export function* updateTask(taskId) {
    // Must be admin
    if (!authorisation.inGroup("admin", this.authenticated)) {
        utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to updateTask denied.`, "info");
        return;
    }

    // Get the values to use
    taskId = unescape(taskId);
    const taskData = this.request.body;

    // Ignore _id if it exists, user cannot change the internal id
    if (taskData._id != null) { delete taskData._id; }

    try {
        yield Task.findOneAndUpdate({ _id: taskId }, taskData).exec();

        // All ok! So set the result
        this.body = "The Task was successfully updated";
        return logger.info(`User ${this.authenticated.email} updated task with id ${taskId}`);
    } catch (err) {
        return utils.logAndSetResponse(this, 500, `Could not update Task by ID {taskId} via the API: ${err}`, "error");
    }
}


/**
 * Deletes a specific Tasks details
 */
export function* removeTask(taskId) {
    // Must be admin
    if (!authorisation.inGroup("admin", this.authenticated)) {
        utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to removeTask denied.`, "info");
        return;
    }

    // Get the values to use
    taskId = unescape(taskId);

    try {
        // Try to get the Task (Call the function that emits a promise and Koa will wait for the function to complete)
        yield Task.remove({ _id: taskId }).exec();

        // All ok! So set the result
        this.body = "The Task was successfully deleted";
        return logger.info(`User ${this.authenticated.email} removed task with id ${taskId}`);
    } catch (err) {
        return utils.logAndSetResponse(this, 500, `Could not remove Task by ID {taskId} via the API: ${err}`, "error");
    }
}
