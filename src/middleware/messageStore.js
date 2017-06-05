// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
let setFinalStatus, transactionStatus;
import transactions from "../model/transactions";
import logger from "winston";
import Q from "q";
import _ from 'lodash';
import { AutoRetry } from '../model/autoRetry';
import autoRetryUtils from '../autoRetry';
import utils from '../utils';

import config from '../config/config';
let statsdServer = config.get('statsd');
let application = config.get('application');
const SDC = require('statsd-client');
let stats = require('../stats');
let os = require('os');

let domain = `${os.hostname()}.${application.name}.appMetrics`;
let sdc = new SDC(statsdServer);

let transactionStatus$1 = (transactionStatus = {
  PROCESSING: 'Processing',
  SUCCESSFUL: 'Successful',
  COMPLETED: 'Completed',
  COMPLETED_W_ERR: 'Completed with error(s)',
  FAILED: 'Failed'
});

export { transactionStatus$1 as transactionStatus };
 function copyMapWithEscapedReservedCharacters(map) {
  let escapedMap = {};
  for (let k in map) {
    let v = map[k];
    if ((k.indexOf('.')>-1) || (k.indexOf('$')>-1)) {
      k = k.replace('.', '\uff0e').replace('$', '\uff04');
    }
    escapedMap[k] = v;
  }
  return escapedMap;
};


export function storeTransaction(ctx, done) {
  logger.info('Storing request metadata for inbound transaction');

  ctx.requestTimestamp = new Date();

  let headers = copyMapWithEscapedReservedCharacters(ctx.header);

  let tx = new transactions.Transaction({
    status: transactionStatus.PROCESSING,
    clientID: (ctx.authenticated != null ? ctx.authenticated._id : undefined),
    channelID: ctx.authorisedChannel._id,
    clientIP: ctx.ip,
    request: {
      host: (ctx.host != null ? ctx.host.split(':')[0] : undefined),
      port: (ctx.host != null ? ctx.host.split(':')[1] : undefined),
      path: ctx.path,
      headers,
      querystring: ctx.querystring,
      body: ctx.body,
      method: ctx.method,
      timestamp: ctx.requestTimestamp
    }
  });

  if (ctx.parentID && ctx.taskID) {
    tx.parentID = ctx.parentID;
    tx.taskID = ctx.taskID;
  }

  if (ctx.currentAttempt) {
    tx.autoRetryAttempt = ctx.currentAttempt;
  }

  // check if channel request body is false and remove - or if request body is empty
  if ((ctx.authorisedChannel.requestBody === false) || (tx.request.body === '')) {
    // reset request body
    tx.request.body = '';
    // check if method is POST|PUT|PATCH - rerun not possible without request body
    if ((ctx.method === 'POST') || (ctx.method === 'PUT') || (ctx.method === 'PATCH')) {
      tx.canRerun = false;
    }
  }

  if (utils.enforceMaxBodiesSize(ctx, tx.request)) { tx.canRerun = false; }

  return tx.save(function(err, tx) {
    if (err) {
      logger.error(`Could not save transaction metadata: ${err}`);
      return done(err);
    } else {
      ctx.transactionId = tx._id;
      ctx.header['X-OpenHIM-TransactionID'] = tx._id.toString();
      return done(null, tx);
    }
  });
}

export function storeResponse(ctx, done) {

  let headers = copyMapWithEscapedReservedCharacters(ctx.response.header);

  let res = {
    status: ctx.response.status,
    headers,
    body: !ctx.response.body ? "" : ctx.response.body.toString(),
    timestamp: ctx.response.timestamp
  };


  // check if channel response body is false and remove
  if (ctx.authorisedChannel.responseBody === false) {
    // reset request body - primary route
    res.body = '';
  }

  let update = {
    response: res,
    error: ctx.error
  };

  utils.enforceMaxBodiesSize(ctx, update.response);

  // Set status from mediator
  if ((ctx.mediatorResponse != null ? ctx.mediatorResponse.status : undefined) != null) {
    update.status = ctx.mediatorResponse.status;
  }

  if (ctx.mediatorResponse) {
    if (ctx.mediatorResponse.orchestrations) {
      update.orchestrations = ctx.mediatorResponse.orchestrations;
      for (let orch of Array.from(update.orchestrations)) {
        if ((orch.request != null ? orch.request.body : undefined) != null) { utils.enforceMaxBodiesSize(ctx, orch.request); }
        if ((orch.response != null ? orch.response.body : undefined) != null) { utils.enforceMaxBodiesSize(ctx, orch.response); }
      }
    }

    if (ctx.mediatorResponse.properties) { update.properties = ctx.mediatorResponse.properties; }
  }

  return transactions.Transaction.findOneAndUpdate({ _id: ctx.transactionId }, update , { runValidators: true }, function(err, tx) {
    if (err) {
      logger.error(`Could not save response metadata for transaction: ${ctx.transactionId}. ${err}`);
      return done(err);
    }
    if ((tx === undefined) || (tx === null)) {
      logger.error(`Could not find transaction: ${ctx.transactionId}`);
      return done(err);
    }
    logger.info(`stored primary response for ${tx._id}`);
    return done();
  });
}

export function storeNonPrimaryResponse(ctx, route, done) {
  // check if channel response body is false and remove
  if (ctx.authorisedChannel.responseBody === false) {
    route.response.body = '';
  }

  if (ctx.transactionId != null) {
    if ((route.request != null ? route.request.body : undefined) != null) { utils.enforceMaxBodiesSize(ctx, route.request); }
    if ((route.response != null ? route.response.body : undefined) != null) { utils.enforceMaxBodiesSize(ctx, route.response); }

    return transactions.Transaction.findByIdAndUpdate(ctx.transactionId, {$push: { "routes": route } } , function(err,tx) {

      if (err) {
        logger.error(err);
      }
      return done(tx);
    });
  } else {
    return logger.error("the request has no transactionId");
  }
}


let setFinalStatus$1 = (setFinalStatus = function(ctx, callback) {
  let transactionId = '';
  if (__guard__(ctx.request != null ? ctx.request.header : undefined, x => x["X-OpenHIM-TransactionID"])) {
    transactionId = ctx.request.header["X-OpenHIM-TransactionID"];
  } else {
    transactionId = ctx.transactionId.toString();
  }

  return transactions.Transaction.findById(transactionId, function(err, tx) {
    let update = {};

    if ((ctx.mediatorResponse != null ? ctx.mediatorResponse.status : undefined) != null) {
      logger.info(`The transaction status has been set to ${ctx.mediatorResponse.status} by the mediator`);
    } else {
      let routeFailures = false;
      let routeSuccess = true;
      if (ctx.routes) {
        for (let route of Array.from(ctx.routes)) {
          if (500 <= route.response.status && route.response.status <= 599) {
            routeFailures = true;
          }
          if (!(200 <= route.response.status && route.response.status <= 299)) {
            routeSuccess = false;
          }
        }
      }

      if (500 <= ctx.response.status && ctx.response.status <= 599) {
        tx.status = transactionStatus.FAILED;
      } else {
        if (routeFailures) {
          tx.status = transactionStatus.COMPLETED_W_ERR;
        }
        if ((200 <= ctx.response.status && ctx.response.status <= 299) && routeSuccess) {
          tx.status = transactionStatus.SUCCESSFUL;
        }
        if ((400 <= ctx.response.status && ctx.response.status <= 499) && routeSuccess) {
          tx.status = transactionStatus.COMPLETED;
        }
      }

      // In all other cases mark as completed
      if (tx.status === 'Processing') {
        tx.status = transactionStatus.COMPLETED;
      }

      ctx.transactionStatus = tx.status;

      logger.info(`Final status for transaction ${tx._id} : ${tx.status}`);
      update.status = tx.status;
    }

    if (ctx.autoRetry != null) {
      if (!autoRetryUtils.reachedMaxAttempts(tx, ctx.authorisedChannel)) {
        update.autoRetry = ctx.autoRetry;
      } else {
        update.autoRetry = false;
      }
    }

    if (_.isEmpty(update)) { return callback(tx); } // nothing to do

    return transactions.Transaction.findByIdAndUpdate(transactionId, update, { },  function(err, tx) {
      callback(tx);

      // queue for autoRetry
      if (update.autoRetry) {
        autoRetryUtils.queueForRetry(tx);
      }

      if (config.statsd.enabled) {
        stats.incrementTransactionCount(ctx, function() {});
        return stats.measureTransactionDuration(ctx, function() {});
      }
    });
  });
});



export { setFinalStatus$1 as setFinalStatus };
export function koaMiddleware(next) {
  let startTime;
  if (statsdServer.enabled) { startTime = new Date(); }
  let saveTransaction = Q.denodeify(exports.storeTransaction);
  ({}); //TODO:Fix yield saveTransaction this
  if (statsdServer.enabled) { sdc.timing(`${domain}.messageStoreMiddleware.storeTransaction`, startTime); }
  ({}); //TODO:Fix yield next
  if (statsdServer.enabled) { startTime = new Date(); }
  exports.storeResponse(this, function() {});
  if (statsdServer.enabled) { return sdc.timing(`${domain}.messageStoreMiddleware.storeResponse`, startTime); }
}

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}