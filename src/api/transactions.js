// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import transactions from '../model/transactions';
import events from '../middleware/events';
import { Channel } from '../model/channels';
import { Client } from '../model/clients';
import autoRetryUtils from '../autoRetry';
import Q from 'q';
import logger from 'winston';
import authorisation from './authorisation';
import utils from "../utils";
import config from '../config/config';
import statsd_client from "statsd-client";
let statsd_server = config.get('statsd');
let sdc = new statsd_client(statsd_server);
let application = config.get('application');
let apiConf = config.get('api');
let os = require("os");
let timer = new Date();
let domain = os.hostname() + '.' + application.name;

 function hasError(updates) {
  let error;
  if (updates.error != null) { return true; }
  if (updates.routes != null) {
    error = false;
    updates.routes.forEach(function(route) {
      if (route.error) { return error = true; }
    });
  }
  if (error) { return true; }
  if (__guard__(updates.$push != null ? updates.$push.routes : undefined, x => x.error) != null) { return true; }
  return false;
};

 function getChannelIDsArray(channels) {
  let channelIDs = [];
  for (let channel of Array.from(channels)) {
    channelIDs.push(channel._id.toString());
  }
  return channelIDs;
};


// function to construct projection object
 function getProjectionObject(filterRepresentation) {
  switch (filterRepresentation) {
    case "simpledetails":
      // view minimum required data for transaction details view
      return { "request.body": 0, "response.body": 0, "routes.request.body": 0, "routes.response.body": 0, "orchestrations.request.body": 0, "orchestrations.response.body": 0 };
    case "full":
      // view all transaction data
      return {};
    case "fulltruncate":
      // same as full
      return {};
    case "bulkrerun":
      // view only 'bulkrerun' properties
      return { "_id": 1, "childIDs": 1, "canRerun": 1, "channelID": 1 };
    default:
      // no filterRepresentation supplied - simple view
      // view minimum required data for transactions
      return { "request.body": 0, "request.headers": 0, "response.body": 0, "response.headers": 0, orchestrations: 0, routes: 0 };
  }
};


 function truncateTransactionDetails(trx) {
  let truncateSize = apiConf.truncateSize != null ? apiConf.truncateSize : 15000;
  let truncateAppend = apiConf.truncateAppend != null ? apiConf.truncateAppend : "\n[truncated ...]";

   function trunc(t) {
    if (((t.request != null ? t.request.body : undefined) != null) && (t.request.body.length > truncateSize)) {
      t.request.body = t.request.body.slice(0, truncateSize) + truncateAppend;
    }
    if (((t.response != null ? t.response.body : undefined) != null) && (t.response.body.length > truncateSize)) {
      return t.response.body = t.response.body.slice(0, truncateSize) + truncateAppend;
    }
  };
  trunc(trx);

  if (trx.routes != null) {
    for (let r of Array.from(trx.routes)) { trunc(r); }
  }

  if (trx.orchestrations != null) {
    return Array.from(trx.orchestrations).map((o) => trunc(o));
  }
};


/*
 * Retrieves the list of transactions
 */

export function getTransactions() {
  try {

    let filtersObject = this.request.query;

    //get limit and page values
    let { filterLimit } = filtersObject;
    let { filterPage } = filtersObject;
    let { filterRepresentation } = filtersObject;

    //remove limit/page/filterRepresentation values from filtersObject (Not apart of filtering and will break filter if present)
    delete filtersObject.filterLimit;
    delete filtersObject.filterPage;
    delete filtersObject.filterRepresentation;

    //determine skip amount
    let filterSkip = filterPage*filterLimit;

    // get filters object
    let filters = (filtersObject.filters != null) ? JSON.parse(filtersObject.filters) : {};

    // Test if the user is authorised
    if (!authorisation.inGroup('admin', this.authenticated)) {
      // if not an admin, restrict by transactions that this user can view
      let needle;
      let channels = {}; //TODO:Fix yield authorisation.getUserViewableChannels this.authenticated

      if (!filtersObject.channelID) {
        filters.channelID = {$in: getChannelIDsArray(channels)};

      } else if ((needle = filtersObject.channelID, !Array.from(getChannelIDsArray(channels)).includes(needle))) {
        return utils.logAndSetResponse(this, 403, `Forbidden: Unauthorized channel ${filtersObject.channelID}`, 'info');
      }

      // set 'filterRepresentation' to default if user isnt admin
      filterRepresentation = '';
    }

    // get projection object
    let projectionFiltersObject = getProjectionObject(filterRepresentation);


    if (filtersObject.channelID) {
      filters.channelID = filtersObject.channelID;
    }

    // parse date to get it into the correct format for querying
    if (filters['request.timestamp']) {
      filters['request.timestamp'] = JSON.parse(filters['request.timestamp']);
    }


    /* Transaction Filters */
    // build RegExp for transaction request path filter
    if (filters['request.path']) {
      filters['request.path'] = new RegExp(filters['request.path'], "i");
    }

    // build RegExp for transaction request querystring filter
    if (filters['request.querystring']) {
      filters['request.querystring'] = new RegExp(filters['request.querystring'], "i");
    }

    // response status pattern match checking
    if (filters['response.status'] && utils.statusCodePatternMatch( filters['response.status'] )) {
      filters['response.status'] = {"$gte": filters['response.status'][0]*100, "$lt": (filters['response.status'][0]*100)+100};
    }

    // check if properties exist
    if (filters['properties']) {
      // we need to source the property key and re-construct filter
      let key = Object.keys(filters['properties'])[0];
      filters[`properties.${key}`] = filters['properties'][key];

      // if property has no value then check if property exists instead
      if (filters['properties'][key] === null) {
        filters[`properties.${key}`] = { '$exists': true };
      }

      // delete the old properties filter as its not needed
      delete filters['properties'];
    }

    // parse childIDs.0 query to get it into the correct format for querying
    // .0 is first index of array - used to validate if empty or not
    if (filters['childIDs.0']) {
      filters['childIDs.0'] = JSON.parse(filters['childIDs.0']);
    }



    /* Route Filters */
    // build RegExp for route request path filter
    if (filters['routes.request.path']) {
      filters['routes.request.path'] = new RegExp(filters['routes.request.path'], "i");
    }

    // build RegExp for transaction request querystring filter
    if (filters['routes.request.querystring']) {
      filters['routes.request.querystring'] = new RegExp(filters['routes.request.querystring'], "i");
    }

    // route response status pattern match checking
    if (filters['routes.response.status'] && utils.statusCodePatternMatch( filters['routes.response.status'] )) {
      filters['routes.response.status'] = {"$gte": filters['routes.response.status'][0]*100, "$lt": (filters['routes.response.status'][0]*100)+100};
    }



    /* orchestration Filters */
    // build RegExp for orchestration request path filter
    if (filters['orchestrations.request.path']) {
      filters['orchestrations.request.path'] = new RegExp(filters['orchestrations.request.path'], "i");
    }

    // build RegExp for transaction request querystring filter
    if (filters['orchestrations.request.querystring']) {
      filters['orchestrations.request.querystring'] = new RegExp(filters['orchestrations.request.querystring'], "i");
    }

    // orchestration response status pattern match checking
    if (filters['orchestrations.response.status'] && utils.statusCodePatternMatch( filters['orchestrations.response.status'] )) {
      filters['orchestrations.response.status'] = {"$gte": filters['orchestrations.response.status'][0]*100, "$lt": (filters['orchestrations.response.status'][0]*100)+100};
    }



    // execute the query
    this.body = {} //TODO:Fix yield transactions.Transaction
      .find(filters, projectionFiltersObject)
      .skip(filterSkip)
      .limit(parseInt(filterLimit))
      .sort({'request.timestamp': -1})
      .exec();

    if (filterRepresentation === 'fulltruncate') {
      return Array.from(this.body).map((trx) => truncateTransactionDetails(trx));
    }

  } catch (e) {
    return utils.logAndSetResponse(this, 500, `Could not retrieve transactions via the API: ${e}`, 'error');
  }
}

 function recursivelySearchObject(ctx, obj, ws, repeat) {
  if (Array.isArray(obj)) {
    return obj.forEach(function(value) {
      if (value && (typeof value === 'object')) {
        if (ws.has(value)) { return; }
        ws.add(value);
        return repeat(ctx, value, ws);
      }
    });
  } else {
    if (obj && (typeof obj === 'object')) {
      for (let k in obj) {
        let value = obj[k];
        if (value && (typeof value === 'object')) {
          if (ws.has(value)) { return; }
          ws.add(value);
          repeat(ctx, value, ws);
        }
      }
    }
  }
};

function enforceMaxBodiesSize (ctx, obj, ws) {
  if (obj.request && (typeof obj.request.body === 'string')) {
    if (utils.enforceMaxBodiesSize(ctx, obj.request) && ctx.PrimaryRequest) { obj.canRerun = false; }
  }
  ctx.PrimaryRequest = false;
  if (obj.response && (typeof obj.response.body === 'string')) { utils.enforceMaxBodiesSize(ctx, obj.response); }
  return recursivelySearchObject(ctx, obj, ws, enforceMaxBodiesSize);
};


function calculateTransactionBodiesByteLength (l, obj, ws) {
  if (obj.body && (typeof obj.body === 'string')) { l += Buffer.byteLength(obj.body); }
  return recursivelySearchObject(l, obj, ws, calculateTransactionBodiesByteLength);
};

/*
 * Adds an transaction
 */
export function addTransaction() {

  // Test if the user is authorised
  if (!authorisation.inGroup('admin', this.authenticated)) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to addTransaction denied.`, 'info');
    return;
  }

  try {
    // Get the values to use
    let transactionData = this.request.body;
    let ctx = { primaryRequest: true };
    enforceMaxBodiesSize(ctx, transactionData, new WeakSet());
  
    let tx = new transactions.Transaction(transactionData);
    
    // Try to add the new transaction (Call the function that emits a promise and Koa will wait for the function to complete)
    ({}); //TODO:Fix yield Q.ninvoke tx, "save"
    this.status = 201;
    logger.info(`User ${this.authenticated.email} created transaction with id ${tx.id}`);

    return generateEvents(tx, tx.channelID);
  } catch (e) {
    return utils.logAndSetResponse(this, 500, `Could not add a transaction via the API: ${e}`, 'error');
  }
}


/*
 * Retrieves the details for a specific transaction
 */
export function getTransactionById(transactionId) {
  // Get the values to use
  transactionId = unescape(transactionId);

  try {
    let filtersObject = this.request.query;
    let { filterRepresentation } = filtersObject;

    //remove filterRepresentation values from filtersObject (Not apart of filtering and will break filter if present)
    delete filtersObject.filterRepresentation;

    // set filterRepresentation to 'full' if not supplied
    if (!filterRepresentation) { filterRepresentation = 'full'; }

    // --------------Check if user has permission to view full content----------------- #
    // if user NOT admin, determine their representation privileges.
    if (!authorisation.inGroup('admin', this.authenticated)) {
      // retrieve transaction channelID
      let txChannelID = {}; //TODO:Fix yield transactions.Transaction.findById(transactionId, channelID: 1, _id: 0).exec()
      if ((txChannelID != null ? txChannelID.length : undefined) === 0) {
        this.body = `Could not find transaction with ID: ${transactionId}`;
        this.status = 404;
        return;
      } else {
        // assume user is not allowed to view all content - show only 'simpledetails'
        filterRepresentation = 'simpledetails';

        // get channel.txViewFullAcl information by channelID
        let channel = {}; //TODO:Fix yield Channel.findById(txChannelID.channelID, txViewFullAcl: 1, _id: 0).exec()

        // loop through user groups
        for (let group of Array.from(this.authenticated.groups)) {
          // if user role found in channel txViewFullAcl - user has access to view all content
          if (channel.txViewFullAcl.indexOf(group) >= 0) {
            // update filterRepresentation object to be 'full' and allow all content
            filterRepresentation = 'full';
            break;
          }
        }
      }
    }

    // --------------Check if user has permission to view full content----------------- #
    // get projection object
    let projectionFiltersObject = getProjectionObject(filterRepresentation);

    let result = {}; //TODO:Fix yield transactions.Transaction.findById(transactionId, projectionFiltersObject).exec()
    if (result && (filterRepresentation === 'fulltruncate')) {
      truncateTransactionDetails(result);
    }

    // Test if the result if valid
    if (!result) {
      this.body = `Could not find transaction with ID: ${transactionId}`;
      return this.status = 404;
    // Test if the user is authorised
    } else if (!authorisation.inGroup('admin', this.authenticated)) {
      let channels = {}; //TODO:Fix yield authorisation.getUserViewableChannels this.authenticated
      if (getChannelIDsArray(channels).indexOf(result.channelID.toString()) >= 0) {
        return this.body = result;
      } else {
        return utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not authenticated to retrieve transaction ${transactionId}`, 'info');
      }
    } else {
      return this.body = result;
    }

  } catch (e) {
    return utils.logAndSetResponse(this, 500, `Could not get transaction by ID via the API: ${e}`, 'error');
  }
}


/*
 * Retrieves all transactions specified by clientId
 */
export function findTransactionByClientId(clientId) {
  clientId = unescape(clientId);

  try {

    let filtersObject = this.request.query;
    let { filterRepresentation } = filtersObject;

    // get projection object
    let projectionFiltersObject = getProjectionObject(filterRepresentation);

    filtersObject = {};
    filtersObject.clientID = clientId;

    // Test if the user is authorised
    if (!authorisation.inGroup('admin', this.authenticated)) {
      // if not an admin, restrict by transactions that this user can view
      let channels = {}; //TODO:Fix yield authorisation.getUserViewableChannels this.authenticated

      filtersObject.channelID = {$in: getChannelIDsArray(channels)};

      // set 'filterRepresentation' to default if user isnt admin
      filterRepresentation = '';
    }

    // execute the query
    return this.body = {} //TODO:Fix yield transactions.Transaction
      .find(filtersObject, projectionFiltersObject)
      .sort({'request.timestamp': -1})
      .exec();

  } catch (e) {
    return utils.logAndSetResponse(this, 500, `Could not get transaction by clientID via the API: ${e}`, 'error');
  }
}


var generateEvents = (transaction, channelID) =>
  Channel.findById(channelID, function(err, channel) {
    logger.debug(`Storing events for transaction: ${transaction._id}`);

    let trxEvents = [];
     function done(err) { if (err) { return logger.error(err); } };

    events.createTransactionEvents(trxEvents, transaction, channel);

    if (trxEvents.length > 0) {
      return events.saveEvents(trxEvents, done);
    }
  })
;


 function updateTransactionMetrics(updates, doc) {
  if ((updates['$push'] != null ? updates['$push'].routes : undefined) != null) {
    return (() => {
      let result = [];
      for (let k in updates['$push']) {
        let route = updates['$push'][k];
        result.push((function(route) {
          let metric;
          if (route.metrics != null) {
            for (metric of Array.from(route.metrics)) {
              if (metric.type === 'counter') {
                logger.debug(`incrementing mediator counter  ${metric.name}`);
                sdc.increment(`${domain}.channels.${doc.channelID}.${route.name}.mediator_metrics.${metric.name}`);
              }

              if (metric.type === 'timer') {
                logger.debug(`incrementing mediator timer  ${metric.name}`);
                sdc.timing(`${domain}.channels.${doc.channelID}.${route.name}.mediator_metrics.${metric.name}`, metric.value);
              }

              if (metric.type === 'gauge') {
                logger.debug(`incrementing mediator gauge  ${metric.name}`);
                sdc.gauge(`${domain}.channels.${doc.channelID}.${route.name}.mediator_metrics.${metric.name}`, metric.value);
              }
            }
          }

          return Array.from(route.orchestrations).map((orchestration) =>
            (function(orchestration) {
              let orchestrationDuration = orchestration.response.timestamp - orchestration.request.timestamp;
              let orchestrationStatus = orchestration.response.status;
              let orchestrationName = orchestration.name;
              if (orchestration.group) {
                orchestrationName = `${orchestration.group}.${orchestration.name}`; //Namespace it by group
              }

              /*
               * Update timers
               */
              logger.debug('updating async route timers');
              sdc.timing(`${domain}.channels.${doc.channelID}.${route.name}.orchestrations.${orchestrationName}`, orchestrationDuration);
              sdc.timing(`${domain}.channels.${doc.channelID}.${route.name}.orchestrations.${orchestrationName}.statusCodes.${orchestrationStatus}` , orchestrationDuration);

              /*
               * Update counters
               */
              logger.debug('updating async route counters');
              sdc.increment(`${domain}.channels.${doc.channelID}.${route.name}.orchestrations.${orchestrationName}`);
              sdc.increment(`${domain}.channels.${doc.channelID}.${route.name}.orchestrations.${orchestrationName}.statusCodes.${orchestrationStatus}`);

              if (orchestration.metrics != null) {
                return (() => {
                  let result1 = [];
                  for (metric of Array.from(orchestration.metrics)) {
                    let item;
                    if (metric.type === 'counter') {
                      logger.debug(`incrementing ${route.name} orchestration counter ${metric.name}`);
                      sdc.increment(`${domain}.channels.${doc.channelID}.${route.name}.orchestrations.${orchestrationName}.${metric.name}`, metric.value);
                    }

                    if (metric.type === 'timer') {
                      logger.debug(`incrementing ${route.name} orchestration timer ${metric.name}`);
                      sdc.timing(`${domain}.channels.${doc.channelID}.${route.name}.orchestrations.${orchestrationName}.${metric.name}`, metric.value);
                    }

                    if (metric.type === 'gauge') {
                      logger.debug(`incrementing ${route.name} orchestration gauge ${metric.name}`);
                      item = sdc.gauge(`${domain}.channels.${doc.channelID}.${route.name}.orchestrations.${orchestrationName}.${metric.name}`, metric.value);
                    }
                    result1.push(item);
                  }
                  return result1;
                })();
              }
            })(orchestration));
        })(route));
      }
      return result;
    })();
  }
};


/*
 * Updates a transaction record specified by transactionId
 */
export function updateTransaction(transactionId) {

  // Test if the user is authorised
  if (!authorisation.inGroup('admin', this.authenticated)) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to updateTransaction denied.`, 'info');
    return;
  }

  transactionId = unescape(transactionId);
  let updates = this.request.body;

  try {
    let tx;
    if (hasError(updates)) {
      tx = {}; //TODO:Fix yield transactions.Transaction.findById(transactionId).exec()
      let channel = {}; //TODO:Fix yield Channel.findById(tx.channelID).exec()
      if (!autoRetryUtils.reachedMaxAttempts(tx, channel)) {
        updates.autoRetry = true;
        autoRetryUtils.queueForRetry(tx);
      }
    }
    
    let transactionToUpdate = {}; //TODO:Fix yield transactions.Transaction.findOne({ _id: transactionId }).exec()
    let transactionBodiesLength = 0;
    calculateTransactionBodiesByteLength(transactionBodiesLength, transactionToUpdate, new WeakSet());

    let ctx = {
      totalBodyLength: transactionBodiesLength,
      primaryRequest: true
    };
    enforceMaxBodiesSize(ctx, updates, new WeakSet());
    
    tx = {}; //TODO:Fix yield transactions.Transaction.findByIdAndUpdate(transactionId, updates, new: true).exec()

    this.body = `Transaction with ID: ${transactionId} successfully updated`;
    this.status = 200;
    logger.info(`User ${this.authenticated.email} updated transaction with id ${transactionId}`);

    generateEvents(updates, tx.channelID);
    return updateTransactionMetrics(updates, tx);

  } catch (e) {
    return utils.logAndSetResponse(this, 500, `Could not update transaction via the API: ${e}`, 'error');
  }
}


/*
 * Removes a transaction
 */
export function removeTransaction(transactionId) {

  // Test if the user is authorised
  if (!authorisation.inGroup('admin', this.authenticated)) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to removeTransaction denied.`, 'info');
    return;
  }

  // Get the values to use
  transactionId = unescape(transactionId);

  try {
    ({}); //TODO:Fix yield transactions.Transaction.findByIdAndRemove(transactionId).exec()
    this.body = 'Transaction successfully deleted';
    this.status = 200;
    return logger.info(`User ${this.authenticated.email} removed transaction with id ${transactionId}`);
  } catch (e) {
    return utils.logAndSetResponse(this, 500, `Could not remove transaction via the API: ${e}`, 'error');
  }
}

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}