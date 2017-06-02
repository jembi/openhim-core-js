// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
let createSecondaryRouteEvents, normalizationBuffer, saveEvents;
import moment from 'moment';
import logger from 'winston';
import events from '../model/events';
import messageStore from '../middleware/messageStore';
import config from '../config/config';
config.events = config.get('events');

if (!config.events) {
  // maybe we're using outdated config
  config.events = config.get('visualizer');
  config.events.normalizationBuffer = config.events.orchestrationTsBufferMillis;
}

let enableTSNormalization = config.events.enableTSNormalization != null ? config.events.enableTSNormalization : false;
if (enableTSNormalization === true) {
  normalizationBuffer = 100;
} else {
  normalizationBuffer = 0;
}

let timestampAsMillis = ts => moment(new Date(ts)).valueOf();

// Determine the difference between baseTS and the earliest timestamp
// present in a collection of routes (buffered for normalization)
let calculateEarliestRouteDiff = function(baseTS, routes) {
  let earliestTS = 0;

  for (let route of Array.from(routes)) {
    let ts = timestampAsMillis(route.request.timestamp);
    if (earliestTS < ts) { earliestTS = ts; }
  }

  let tsDiff = baseTS - earliestTS;
  tsDiff += normalizationBuffer;

  return tsDiff;
};

let determineStatusType = function(statusCode) {
  let status = 'success';
  if (500 <= statusCode && statusCode <= 599) {
    status = 'error';
  }
  return status;
};


let saveEvents$1 = (saveEvents = function(trxEvents, callback) {
  let now = new Date;
  for (let event of Array.from(trxEvents)) { event.created = now; }

  // bypass mongoose for quick batch inserts
  // index needs to be ensured manually since the collection might not already exist
  return events.Event.collection.ensureIndex({ created: 1 }, { expireAfterSeconds: 3600 }, () => events.Event.collection.insert(trxEvents, err => err ? callback(err) : callback()));
});


export { saveEvents$1 as saveEvents };
let createRouteEvents = function(dst, transactionId, channel, route, type, tsAdjustment, autoRetryAttempt) {
  if ((__guard__(route != null ? route.request : undefined, x => x.timestamp) != null) && (__guard__(route != null ? route.response : undefined, x1 => x1.timestamp) != null)) {
    let startTS = timestampAsMillis(route.request.timestamp);
    let endTS = timestampAsMillis(route.response.timestamp);

    if (enableTSNormalization === true) {
      startTS = startTS + tsAdjustment;
      endTS = endTS + tsAdjustment;
    }

    if (startTS > endTS) { startTS = endTS; }

    dst.push({
      channelID: channel._id,
      transactionID: transactionId,
      normalizedTimestamp: startTS,
      type,
      event: 'start',
      name: route.name,
      mediator: route.mediatorURN,
      autoRetryAttempt
    });

    return dst.push({
      channelID: channel._id,
      transactionID: transactionId,
      normalizedTimestamp: endTS,
      type,
      event: 'end',
      name: route.name,
      mediator: route.mediatorURN,
      status: route.response.status,
      statusType: determineStatusType(route.response.status),
      autoRetryAttempt
    });
  }
};

let createChannelStartEvent = (dst, transactionId, requestTimestamp, channel, autoRetryAttempt) =>
  dst.push({
    channelID: channel._id,
    transactionID: transactionId,
    normalizedTimestamp: timestampAsMillis(requestTimestamp),
    type: 'channel',
    event: 'start',
    name: channel.name,
    autoRetryAttempt
  })
;

let createChannelEndEvent = function(dst, transactionId, requestTimestamp, channel, response, autoRetryAttempt) {
  let startTS = timestampAsMillis(requestTimestamp);

  let endTS = timestampAsMillis(response.timestamp);
  if (endTS < startTS) { endTS = startTS; }

  return dst.push({
    channelID: channel._id,
    transactionID: transactionId,
    normalizedTimestamp: endTS + normalizationBuffer,
    type: 'channel',
    event: 'end',
    name: channel.name,
    status: response.status,
    statusType: determineStatusType(response.status),
    autoRetryAttempt
  });
};

let createPrimaryRouteEvents = function(dst, transactionId, requestTimestamp, channel, routeName, mediatorURN, response, autoRetryAttempt) {
  let startTS = timestampAsMillis(requestTimestamp);

  dst.push({
    channelID: channel._id,
    transactionID: transactionId,
    normalizedTimestamp: startTS,
    type: 'primary',
    event: 'start',
    name: routeName,
    mediator: mediatorURN,
    autoRetryAttempt
  });

  let endTS = timestampAsMillis(response.timestamp);
  if (endTS < startTS) { endTS = startTS; }

  return dst.push({
    channelID: channel._id,
    transactionID: transactionId,
    normalizedTimestamp: endTS + normalizationBuffer,
    type: 'primary',
    event: 'end',
    name: routeName,
    status: response.status,
    statusType: determineStatusType(response.status),
    mediator: mediatorURN,
    autoRetryAttempt
  });
};


let createOrchestrationEvents = function(dst, transactionId, requestTimestamp, channel, orchestrations) {
  let tsDiff;
  if (requestTimestamp) {
    let startTS = timestampAsMillis(requestTimestamp);
    tsDiff = calculateEarliestRouteDiff(startTS, orchestrations);
  }

  return Array.from(orchestrations).map((orch) => createRouteEvents(dst, transactionId, channel, orch, 'orchestration', tsDiff));
};

let createSecondaryRouteEvents$1 = (createSecondaryRouteEvents = function(dst, transactionId, requestTimestamp, channel, routes) {
  let startTS = timestampAsMillis(requestTimestamp);
  let tsDiff = calculateEarliestRouteDiff(startTS, routes);

  return (() => {
    let result = [];
    for (let route of Array.from(routes)) {
      let item;
      createRouteEvents(dst, transactionId, channel, route, 'route', tsDiff);

      if (route.orchestrations) {
        // find TS difference
        tsDiff = calculateEarliestRouteDiff(startTS, route.orchestrations);
        item = Array.from(route.orchestrations).map((orch) => createRouteEvents(dst, transactionId, channel, orch, 'orchestration', tsDiff));
      }
      result.push(item);
    }
    return result;
  })();
});


export { createSecondaryRouteEvents$1 as createSecondaryRouteEvents };
export function createTransactionEvents(dst, transaction, channel) {
  let getPrimaryRouteName = function() {
    for (let r of Array.from(channel.routes)) {
      if (r.primary) { return r.name; }
    }
    return null;
  };

  let timestamp = (transaction.request != null ? transaction.request.timestamp : undefined) ? transaction.request.timestamp : new Date();

  if (transaction.request && transaction.response) {
    createPrimaryRouteEvents(dst, transaction._id, timestamp, channel, getPrimaryRouteName(), null, transaction.response);
  }
  if (transaction.orchestrations) {
    createOrchestrationEvents(dst, transaction._id, timestamp, channel, transaction.orchestrations);
  }
  if (transaction.routes) {
    return createSecondaryRouteEvents(dst, transaction._id, timestamp, channel, transaction.routes);
  }
}


export function koaMiddleware(next) {
  let ctx = this;

  let runAsync = method =>
    (function(ctx) {
      let f = () => method(ctx, function(err) { if (err) { return logger.err(err); } });
      return setTimeout(f, 0);
    })(ctx)
  ;

  runAsync(function(ctx, done) {
    logger.debug(`Storing channel start event for transaction: ${ctx.transactionId}`);
    let trxEvents = [];
    createChannelStartEvent(trxEvents, ctx.transactionId, ctx.requestTimestamp, ctx.authorisedChannel, ctx.currentAttempt);
    return saveEvents(trxEvents, done);
  });

  ({}); //TODO:Fix yield next

  return runAsync(function(ctx, done) {
    logger.debug(`Storing channel end and primary routes events for transaction: ${ctx.transactionId}`);

    let trxEvents = [];

    let mediatorURN = ctx.mediatorResponse != null ? ctx.mediatorResponse['x-mediator-urn'] : undefined;
    let orchestrations = ctx.mediatorResponse != null ? ctx.mediatorResponse.orchestrations : undefined;

    createPrimaryRouteEvents(trxEvents, ctx.transactionId, ctx.requestTimestamp, ctx.authorisedChannel, ctx.primaryRoute.name, mediatorURN, ctx.response, ctx.currentAttempt);
    if (orchestrations) {
      createOrchestrationEvents(trxEvents, ctx.transactionId, ctx.requestTimestamp, ctx.authorisedChannel, orchestrations, ctx.currentAttempt);
    }
    createChannelEndEvent(trxEvents, ctx.transactionId, ctx.requestTimestamp, ctx.authorisedChannel, ctx.response, ctx.currentAttempt);
    return saveEvents(trxEvents, done);
  });
}

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}