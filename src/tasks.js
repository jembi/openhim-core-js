// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import { Task as TaskModel } from './model/tasks';
import { Channel } from './model/channels';
import Q from "q";
import logger from "winston";
import config from "./config/config";
config.rerun = config.get('rerun');
let http = require('http');
let TransactionModel = require("./model/transactions").Transaction;
let net = require("net");
let rerunMiddleware = require("./middleware/rerunUpdateTransactionTask");


let live = false;
let activeTasks = 0;


var findAndProcessAQueuedTask = () =>
  TaskModel.findOneAndUpdate({ status: 'Queued' }, { status: 'Processing' }, { 'new': true }, function(err, task) {
    if (err) {
      return logger.error(`An error occurred while looking for rerun tasks: ${err}`);
    } else if (task) {
      activeTasks++;
      processNextTaskRound(task, function(err) {
        if (err) { logger.error(`An error occurred while processing rerun task ${task._id}: ${err}`); }
        activeTasks--;
        // task has finished its current round, pick up the next one
        if (live) { return findAndProcessAQueuedTask(); }
      });

      // task has started processing, pick up the next one
      if (live) { return findAndProcessAQueuedTask(); }
    }
  })
;

var rerunTaskProcessor = function() {
  if (live) {
    findAndProcessAQueuedTask();
    return setTimeout(rerunTaskProcessor, config.rerun.processor.pollPeriodMillis);
  }
};


export function start(callback) {
  live = true;
  setTimeout(rerunTaskProcessor, config.rerun.processor.pollPeriodMillis);

  logger.info("Started rerun task processor");
  return callback();
}


export function stop(callback) {
  live = false;

  var waitForActiveTasks = function() {
    if (activeTasks > 0) {
      return setTimeout(waitForActiveTasks, 100);
    } else {
      logger.info("Stopped rerun task processor");
      return callback();
    }
  };

  return waitForActiveTasks();
}

export function isRunning() { return live; }


let finalizeTaskRound = (task, callback) =>
  // get latest status in case it has been changed
  TaskModel.findOne({ _id: task._id }, { status: 1 }, function(err, result) {
    if (err) { return callback(err); }

    // Only queue the task if still in 'Processing'
    // (the status could have been changed to paused or cancelled)
    if ((result.status === 'Processing') && (task.remainingTransactions !== 0)) {
      task.status = 'Queued';
      logger.info(`Round completed for rerun task #${task._id} - ${task.remainingTransactions} transactions remaining`);
    } else {
      if (task.remainingTransactions === 0) {
        task.status =  'Completed';
        task.completedDate = new Date();
        logger.info(`Round completed for rerun task #${task._id} - Task completed`);
      } else {
        task.status = result.status;
        logger.info(`Round completed for rerun task #${task._id} - Task has been ${result.status}`);
      }
    }

    return task.save(err => callback(err));
  })
;

// Process a task.
//
// Tasks are processed in rounds:
// Each round consists of processing n transactions where n is between 1 and the task's batchSize,
// depending on how many transactions are left to process.
//
// When a round completes, the task will be marked as 'Queued' if it still has transactions remaining.
// The next available core instance will then pick up the task again for the next round.
//
// This model allows the instance the get updated information regarding the task in between rounds:
// i.e. if the server has been stopped, if the task has been paused, etc.
var processNextTaskRound = function(task, callback) {
  logger.debug(`Processing next task round: total transactions = ${task.totalTransactions}, remainingTransactions = ${task.remainingTransactions}`);
  let promises = [];
  let nextI = task.transactions.length - task.remainingTransactions;

  for (let transaction of Array.from(task.transactions.slice(nextI ,  nextI+task.batchSize))) {
    (function(transaction) {
      let defer = Q.defer();

      rerunTransaction(transaction.tid, task._id, function(err, response) {
        if (err) {
          transaction.tstatus = 'Failed';
          transaction.error = err;
          logger.error(`An error occurred while rerunning transaction ${transaction.tid} for task ${task._id}: ${err}`);
        } else if ((response != null ? response.status : undefined) === 'Failed') {
          transaction.tstatus = 'Failed';
          transaction.error = response.message;
          logger.error(`An error occurred while rerunning transaction ${transaction.tid} for task ${task._id}: ${err}`);
        } else {
          transaction.tstatus = 'Completed';
        }

        task.remainingTransactions--;
        return defer.resolve();
      });

      transaction.tstatus = 'Processing';

      return promises.push(defer.promise);
    })(transaction);
  }

  return (Q.all(promises)).then(() =>
    // Save task once transactions have been updated
    task.save(function(err) {
      if (err != null) {
        logger.error(`Failed to save current task while processing round: taskID=${task._id}, err=${err}`, err);
      }
      return finalizeTaskRound(task, callback);
    })
  );
};


var rerunTransaction = (transactionID, taskID, callback) =>
  rerunGetTransaction(transactionID, function(err, transaction) {
    if (err) { return callback(err); }

    // setup the option object for the HTTP Request
    return Channel.findById(transaction.channelID, function(err, channel) {
      if (err) { return callback(err); }

      logger.info(`Rerunning ${channel.type} transaction`);

      if ((channel.type === 'http') || (channel.type === 'polling')) {
        rerunSetHTTPRequestOptions(transaction, taskID, function(err, options) {
          if (err) { return callback(err); }

          // Run the HTTP Request with details supplied in options object
          return rerunHttpRequestSend(options, transaction, (err, HTTPResponse) => callback(err, HTTPResponse));
        });
      }


      if ((channel.type === 'tcp') || (channel.type === 'tls')) {
        return rerunTcpRequestSend(channel, transaction, function(err, TCPResponse) {
          if (err) { return callback(err); }

          // Update original
          let ctx = {
            parentID : transaction._id,
            transactionId : transactionID,
            transactionStatus: TCPResponse.status,
            taskID
          };

          return rerunMiddleware.updateOriginalTransaction(ctx, function(err) {
            if (err) { return callback(err); }
            return rerunMiddleware.updateTask(ctx, callback);
          });
        });
      }
    });
  })
;


var rerunGetTransaction = (transactionID, callback) =>
  TransactionModel.findById(transactionID, function(err, transaction) {
    if ((transaction == null)) {
      return callback((new Error(`Transaction ${transactionID} could not be found`)), null);
    }

    // check if 'canRerun' property is false - reject the rerun
    if (!transaction.canRerun) {
      err = new Error(`Transaction ${transactionID} cannot be rerun as there isn't enough information about the request`);
      return callback(err, null);
    }

    // send the transactions data in callback
    return callback(null, transaction);
  })
;



//####################################
// Construct HTTP options to be sent #
//####################################

var rerunSetHTTPRequestOptions = function(transaction, taskID, callback) {

  if (transaction === null) {
    let err = new Error("An empty Transaction object was supplied. Aborting HTTP options configuration");
    return callback(err, null);
  }

  logger.info(`Rerun Transaction #${transaction._id} - HTTP Request options being configured`);
  let options = {
    hostname: config.rerun.host,
    port: config.rerun.httpPort,
    path: transaction.request.path,
    method: transaction.request.method,
    headers: transaction.request.headers
  };

  if (transaction.clientID) {
    options.headers.clientID = transaction.clientID;
  }

  options.headers.parentID = transaction._id;
  options.headers.taskID = taskID;

  if (transaction.request.querystring) {
    options.path += `?${transaction.request.querystring}`;
  }

  return callback(null, options);
};

//####################################
// Construct HTTP options to be sent #
//####################################



//####################################
// Function for sending HTTP Request #
//####################################

var rerunHttpRequestSend = function(options, transaction, callback) {

  let err;
  if (options === null) {
    err = new Error("An empty 'Options' object was supplied. Aborting HTTP Send Request");
    return callback(err, null);
  }

  if (transaction === null) {
    err = new Error("An empty 'Transaction' object was supplied. Aborting HTTP Send Request");
    return callback(err, null);
  }

  let response = {
    body: '',
    transaction: {}
  };

  logger.info(`Rerun Transaction #${transaction._id} - HTTP Request is being sent...`);
  let req = http.request(options, function(res) {

    res.on("data", chunk =>
      // response data
      response.body += chunk
    );

    return res.on("end", function(err) {
      if (err) {
        response.transaction.status = "Failed";
      } else {
        response.transaction.status = "Completed";
      }
      
      response.status = res.statusCode;
      response.message = res.statusMessage;
      response.headers = res.headers;
      response.timestamp = new Date;
      
      logger.info(`Rerun Transaction #${transaction._id} - HTTP Response has been captured`);
      return callback(null, response);
    });
  });
  
  req.on("error", function(err) {
    // update the status of the transaction that was processed to indicate it failed to process
    if (err) { response.transaction.status = "Failed"; }

    response.status = 500;
    response.message = "Internal Server Error";
    response.timestamp = new Date;

    return callback(null, response);
  });

  // write data to request body
  if ((transaction.request.method === "POST") || (transaction.request.method === "PUT")) {
    req.write(transaction.request.body);
  }
  return req.end();
};



var rerunTcpRequestSend = function(channel, transaction, callback) {

  let response = {
    body: '',
    transaction: {}
  };

  let client = new net.Socket();

  client.connect(channel.tcpPort, channel.tcpHost, function() {
    logger.info(`Rerun Transaction ${transaction._id}: TCP connection established`);
    client.end(transaction.request.body);
  });

  client.on("data", data => response.body += data);


  client.on("end" , function(data) {

    response.status = 200;
    response.transaction.status = "Completed";
    response.message = '';
    response.headers = {};
    response.timestamp = new Date;

    logger.info(`Rerun Transaction #${transaction._id} - TCP Response has been captured`);
    callback(null, response);
  });

  return client.on("error" , function(err) {
    // update the status of the transaction that was processed to indicate it failed to process
    if (err) { response.transaction.status = "Failed"; }

    response.status = 500;
    response.message = "Internal Server Error";
    response.timestamp = new Date;

    return callback(err, response);
  });
};

//########################################################
// Export these functions when in the "test" environment #
//########################################################

if (process.env.NODE_ENV === "test") {
  exports.rerunGetTransaction = rerunGetTransaction;
  exports.rerunSetHTTPRequestOptions = rerunSetHTTPRequestOptions;
  exports.rerunHttpRequestSend = rerunHttpRequestSend;
  exports.rerunTcpRequestSend = rerunTcpRequestSend;
  exports.findAndProcessAQueuedTask = findAndProcessAQueuedTask;
}
