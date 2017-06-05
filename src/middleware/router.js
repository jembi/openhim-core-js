// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
let numberOfPrimaryRoutes, transformPath;
import util from 'util';
import zlib from 'zlib';
import http from 'http';
import https from 'https';
import net from 'net';
import tls from 'tls';
import Q from 'q';
import config from '../config/config';
config.mongo = config.get('mongo');
config.router = config.get('router');
let logger = require('winston');
let cookie = require('cookie');
let fs = require('fs');
let utils = require('../utils');
let messageStore = require('../middleware/messageStore');
let events = require('../middleware/events');
let stats = require("../stats");
let statsdServer = config.get('statsd');
let application = config.get('application');
const SDC = require('statsd-client');
let os = require('os');

let domain = `${os.hostname()}.${application.name}.appMetrics`;
let sdc = new SDC(statsdServer);


let isRouteEnabled = route => (route.status == null) || (route.status === 'enabled');

let numberOfPrimaryRoutes$1 = (numberOfPrimaryRoutes = function(routes) {
  let numPrimaries = 0;
  for (let route of Array.from(routes)) {
    if (isRouteEnabled(route) && route.primary) { numPrimaries++; }
  }
  return numPrimaries;
});

export { numberOfPrimaryRoutes$1 as numberOfPrimaryRoutes };
let containsMultiplePrimaries = routes => numberOfPrimaryRoutes(routes) > 1;


 function setKoaResponse(ctx, response) {

  // Try and parse the status to an int if it is a string
  let err;
  if (typeof response.status === 'string') {
    try {
      response.status = parseInt(response.status);
    } catch (error) {
      err = error;
      logger.error(err);
    }
  }

  ctx.response.status = response.status;
  ctx.response.timestamp = response.timestamp;
  ctx.response.body = response.body;

  if (!ctx.response.header) {
    ctx.response.header = {};
  }

  if (__guard__(ctx.request != null ? ctx.request.header : undefined, x => x["X-OpenHIM-TransactionID"])) {
    if ((response != null ? response.headers : undefined) != null) {
      response.headers["X-OpenHIM-TransactionID"] = ctx.request.header["X-OpenHIM-TransactionID"];
    }
  }

  return (() => {
    let result = [];
    for (let key in response.headers) {
      let value = response.headers[key];
      switch (key.toLowerCase()) {
        case 'set-cookie': result.push(setCookiesOnContext(ctx, value)); break;
        case 'location':
          if ((response.status >= 300) && (response.status < 400)) {
            result.push(ctx.response.redirect(value));
          } else {
            result.push(ctx.response.set(key, value));
          }
          break;
        case 'content-type': result.push(ctx.response.type = value); break;
        default:
          try {
            // Strip the content and transfer encoding headers
            if ((key !== 'content-encoding') && (key !== 'transfer-encoding')) {
              result.push(ctx.response.set(key, value));
            }
          } catch (error1) {
            err = error1;
            result.push(logger.error(err));
          }
      }
    }
    return result;
  })();
};

if (process.env.NODE_ENV === "test") {
  exports.setKoaResponse = setKoaResponse;
}

var setCookiesOnContext = function(ctx, value) {
  logger.info('Setting cookies on context');
  return (() => {
    let result = [];
    for (let c_value = 0; c_value < value.length; c_value++) {
      var p_val;
      let c_key = value[c_value];
      var c_opts = {path:false,httpOnly:false}; //clear out default values in cookie module
      var c_vals = {};
      let object = cookie.parse(c_key);
      for (var p_key in object) {
        p_val = object[p_key];
        let p_key_l = p_key.toLowerCase();
        switch (p_key_l) {
          case 'max-age': c_opts['maxage'] = parseInt(p_val, 10); break;
          case 'expires': c_opts['expires'] = new Date(p_val); break;
          case 'path':case 'domain':case 'secure':case 'signed':case 'overwrite': c_opts[p_key_l] = p_val; break;
          case 'httponly': c_opts['httpOnly'] = p_val; break;
          default: c_vals[p_key] = p_val;
        }
      }
      result.push((() => {
        let result1 = [];
        for (p_key in c_vals) {
          p_val = c_vals[p_key];
          result1.push(ctx.cookies.set(p_key,p_val,c_opts));
        }
        return result1;
      })());
    }
    return result;
  })();
};

 function handleServerError(ctx, err, route) {
  ctx.autoRetry = true;
  if (route) {
    route.error = {
      message: err.message,
      stack: err.stack ? err.stack : undefined
    };
  } else {
    ctx.response.status = 500;
    ctx.response.timestamp = new Date();
    ctx.response.body = "An internal server error occurred";
    // primary route error
    ctx.error = {
      message: err.message,
      stack: err.stack ? err.stack : undefined
    };
  }

  logger.error(`[${(ctx.transactionId != null ? ctx.transactionId.toString() : undefined)}] Internal server error occured: ${err}`);
  if (err.stack) { return logger.error(`${err.stack}`); }
};


 function sendRequestToRoutes(ctx, routes, next) {
  let promises = [];
  let promise = {};
  ctx.timer = new Date;

  if (containsMultiplePrimaries(routes)) {
    return next(new Error("Cannot route transaction: Channel contains multiple primary routes and only one primary is allowed"));
  }

  return utils.getKeystore(function(err, keystore) {

    for (let route of Array.from(routes)) {
      (function(route) {
        if (!isRouteEnabled(route)) { return; } //continue

        let path = getDestinationPath(route, ctx.path);
        let options = {
          hostname: route.host,
          port: route.port,
          path,
          method: ctx.request.method,
          headers: ctx.request.header,
          agent: false,
          rejectUnauthorized: true,
          key: keystore.key,
          cert: keystore.cert.data,
          secureProtocol: 'TLSv1_method'
        };

        if (route.cert != null) {
          options.ca = keystore.ca.id(route.cert).data;
        }

        if (ctx.request.querystring) {
          options.path += `?${ctx.request.querystring}`;
        }

        if (options.headers && options.headers.authorization && !route.forwardAuthHeader) {
          delete options.headers.authorization;
        }

        if (route.username && route.password) {
          options.auth = route.username + ":" + route.password;
        }

        if (options.headers && options.headers.host) {
          delete options.headers.host;
        }

        if (route.primary) {
          ctx.primaryRoute = route;
          promise = sendRequest(ctx, route, options)
          .then(function(response) {
            logger.info(`executing primary route : ${route.name}`);
            if (__guard__(response.headers != null ? response.headers['content-type'] : undefined, x => x.indexOf('application/json+openhim')) > -1) {
              // handle mediator reponse
              let responseObj = JSON.parse(response.body);
              ctx.mediatorResponse = responseObj;

              if (responseObj.error != null) {
                ctx.autoRetry = true;
                ctx.error = responseObj.error;
              }

              // then set koa response from responseObj.response
              return setKoaResponse(ctx, responseObj.response);
            } else {
              return setKoaResponse(ctx, response);
            }}).then(function() {
            logger.info("primary route completed");
            return next();}).fail(function(reason) {
            // on failure
            handleServerError(ctx, reason);
            return next();
          });
        } else {
          logger.info(`executing non primary: ${route.name}`);
          promise = buildNonPrimarySendRequestPromise(ctx, route, options, path)
          .then(function(routeObj) {
            logger.info(`Storing non primary route responses ${route.name}`);

            try {
              if (((routeObj != null ? routeObj.name : undefined) == null)) {
                routeObj =
                  {name: route.name};
              }

              if (((routeObj != null ? routeObj.response : undefined) == null)) {
                routeObj.response = {
                  status: 500,
                  timestamp: ctx.requestTimestamp
                };
              }

              if (((routeObj != null ? routeObj.request : undefined) == null)) {
                routeObj.request = {
                  host: options.hostname,
                  port: options.port,
                  path,
                  headers: ctx.request.header,
                  querystring: ctx.request.querystring,
                  method: ctx.request.method,
                  timestamp: ctx.requestTimestamp
                };
              }

              return messageStore.storeNonPrimaryResponse(ctx, routeObj, () =>
                stats.nonPrimaryRouteRequestCount(ctx, routeObj, () => stats.nonPrimaryRouteDurations(ctx, routeObj, function() {}))
              );

            } catch (err) {
              return logger.error(err);
            }
          });
        }


        return promises.push(promise);
      })(route);
    }

    return (Q.all(promises)).then(() =>
      messageStore.setFinalStatus(ctx, function() {
        logger.info(`All routes completed for transaction: ${ctx.transactionId.toString()}`);
        if (ctx.routes) {
          logger.debug(`Storing route events for transaction: ${ctx.transactionId}`);

           function done(err) { if (err) { return logger.error(err); } };
          let trxEvents = [];

          events.createSecondaryRouteEvents(trxEvents, ctx.transactionId, ctx.requestTimestamp, ctx.authorisedChannel, ctx.routes, ctx.currentAttempt);
          return events.saveEvents(trxEvents, done);
        }
      })
    );
  });
};


// function to build fresh promise for transactions routes
var buildNonPrimarySendRequestPromise = (ctx, route, options, path) =>
  sendRequest(ctx, route, options)
  .then(function(response) {
    let routeObj = {};
    routeObj.name = route.name;
    routeObj.request = {
      host: options.hostname,
      port: options.port,
      path,
      headers: ctx.request.header,
      querystring: ctx.request.querystring,
      method: ctx.request.method,
      timestamp: ctx.requestTimestamp
    };

    if (__guard__(response.headers != null ? response.headers['content-type'] : undefined, x => x.indexOf('application/json+openhim')) > -1) {
      // handle mediator reponse
      let responseObj = JSON.parse(response.body);
      routeObj.mediatorURN = responseObj['x-mediator-urn'];
      routeObj.orchestrations = responseObj.orchestrations;
      routeObj.properties = responseObj.properties;
      if (responseObj.metrics) { routeObj.metrics = responseObj.metrics; }
      routeObj.response = responseObj.response;
    } else {
      routeObj.response = response;
    }

    if (!ctx.routes) { ctx.routes = []; }
    ctx.routes.push(routeObj);
    return routeObj;}).fail(function(reason) {
    // on failure
    let routeObj = {};
    routeObj.name = route.name;
    handleServerError(ctx, reason, routeObj);
    return routeObj;
  })
;

var sendRequest = function(ctx, route, options) {
  if ((route.type === 'tcp') || (route.type === 'mllp')) {
    logger.info('Routing socket request');
    return sendSocketRequest(ctx, route, options);
  } else {
    logger.info('Routing http(s) request');
    return sendHttpRequest(ctx, route, options);
  }
};

 function obtainCharset(headers) {
  let contentType = headers['content-type'] || '';
  let matches =  contentType.match(/charset=([^;,\r\n]+)/i);
  if (matches && matches[1]) {
    return matches[1];
  }
  return  'utf-8';
};

/*
 * A promise returning function that send a request to the given route and resolves
 * the returned promise with a response object of the following form:
 *   response =
 *    status: <http_status code>
 *    body: <http body>
 *    headers: <http_headers_object>
 *    timestamp: <the time the response was recieved>
 */
var sendHttpRequest = function(ctx, route, options) {
  let defered = Q.defer();
  let response = {};

  let gunzip = zlib.createGunzip();
  let inflate = zlib.createInflate();

  let method = http;

  if (route.secured) {
    method = https;
  }

  let routeReq = method.request(options, function(routeRes) {
    response.status = routeRes.statusCode;
    response.headers = routeRes.headers;

    let uncompressedBodyBufs = [];
    if (routeRes.headers['content-encoding'] === 'gzip') { //attempt to gunzip
      routeRes.pipe(gunzip);

      gunzip.on("data", function(data) {
        uncompressedBodyBufs.push(data);
      });
    }

    if (routeRes.headers['content-encoding'] === 'deflate') { //attempt to inflate
      routeRes.pipe(inflate);

      inflate.on("data", function(data) {
        uncompressedBodyBufs.push(data);
      });
    }

    let bufs = [];
    routeRes.on("data", chunk => bufs.push(chunk));

    // See https://www.exratione.com/2014/07/nodejs-handling-uncertain-http-response-compression/
    return routeRes.on("end", function() {
      response.timestamp = new Date();
      let charset = obtainCharset(routeRes.headers);
      if (routeRes.headers['content-encoding'] === 'gzip') {
        return gunzip.on("end", function() {
          let uncompressedBody =  Buffer.concat(uncompressedBodyBufs);
          response.body = uncompressedBody.toString(charset);
          if (!defered.promise.isRejected()) {
            defered.resolve(response);
          }
        });

      } else if (routeRes.headers['content-encoding'] === 'deflate') {
        return inflate.on("end", function() {
          let uncompressedBody =  Buffer.concat(uncompressedBodyBufs);
          response.body = uncompressedBody.toString(charset);
          if (!defered.promise.isRejected()) {
            defered.resolve(response);
          }
        });

      } else {
        response.body = Buffer.concat(bufs);
        if (!defered.promise.isRejected()) {
          return defered.resolve(response);
        }
      }
    });
  });

  routeReq.on("error", err => defered.reject(err));

  routeReq.on("clientError", err => defered.reject(err));

  routeReq.setTimeout(+config.router.timeout, () => defered.reject("Request Timed Out"));

  if ((ctx.request.method === "POST") || (ctx.request.method === "PUT")) {
    routeReq.write(ctx.body);
  }

  routeReq.end();

  return defered.promise;
};

/*
 * A promise returning function that send a request to the given route using sockets and resolves
 * the returned promise with a response object of the following form: ()
 *   response =
 *    status: <200 if all work, else 500>
 *    body: <the received data from the socket>
 *    timestamp: <the time the response was recieved>
 *
 * Supports both normal and MLLP sockets
 */
var sendSocketRequest = function(ctx, route, options) {
  let mllpEndChar = String.fromCharCode(0o034);

  let defered = Q.defer();
  let requestBody = ctx.body;
  let response = {};

  let method = net;
  if (route.secured) {
    method = tls;
  }

  options = {
    host: options.hostname,
    port: options.port,
    rejectUnauthorized: options.rejectUnauthorized,
    key: options.key,
    cert: options.cert,
    secureProtocol: options.secureProtocol,
    ca: options.ca
  };

  var client = method.connect(options, function() {
    logger.info(`Opened ${route.type} connection to ${options.host}:${options.port}`);
    if (route.type === 'tcp') {
      return client.end(requestBody);
    } else if (route.type === 'mllp') {
      return client.write(requestBody);
    } else {
      return logger.error(`Unkown route type ${route.type}`);
    }
  });

  let bufs = [];
  client.on('data', function(chunk) {
    bufs.push(chunk);
    if ((route.type === 'mllp') && (chunk.toString().indexOf(mllpEndChar) > -1)) {
      logger.debug('Received MLLP response end character');
      return client.end();
    }
  });

  client.on('error', err => defered.reject(err));

  client.on('clientError', err => defered.reject(err));

  client.on('end', function() {
    logger.info(`Closed ${route.type} connection to ${options.host}:${options.port}`);

    if (route.secured && !client.authorized) {
      return defered.reject(new Error('Client authorization failed'));
    }
    response.body = Buffer.concat(bufs);
    response.status = 200;
    response.timestamp = new Date();
    if (!defered.promise.isRejected()) {
      return defered.resolve(response);
    }
  });

  return defered.promise;
};

var getDestinationPath = function(route, requestPath) {
  if (route.path) {
    return route.path;
  } else if (route.pathTransform) {
    return transformPath(requestPath, route.pathTransform);
  } else {
    return requestPath;
  }
};

/*
 * Applies a sed-like expression to the path string
 *
 * An expression takes the form s/from/to
 * Only the first 'from' match will be substituted
 * unless the global modifier as appended: s/from/to/g
 *
 * Slashes can be escaped as \/
 */
let transformPath$1 = (transformPath = function(path, expression) {
  // replace all \/'s with a temporary ':' char so that we don't split on those
  // (':' is safe for substitution since it cannot be part of the path)
  let fromRegex;
  let sExpression = expression.replace(/\\\//g, ':');
  let sub = sExpression.split('/');

  let from = sub[1].replace(/:/g, '\/');
  let to = sub.length > 2 ? sub[2] : "";
  to = to.replace(/:/g, '\/');

  if ((sub.length > 3) && (sub[3] === 'g')) {
    fromRegex = new RegExp(from, 'g');
  } else {
    fromRegex = new RegExp(from);
  }

  return path.replace(fromRegex, to);
});


/*
 * Gets the authorised channel and routes
 * the request to all routes within that channel. It updates the
 * response of the context object to reflect the response recieved from the
 * route that is marked as 'primary'.
 *
 * Accepts (ctx, next) where ctx is a [Koa](http://koajs.com/) context
 * object and next is a callback that is called once the route marked as
 * primary has returned an the ctx.response object has been updated to
 * reflect the response from that route.
 */
export { transformPath$1 as transformPath };
export function route(ctx, next) {
  let channel = ctx.authorisedChannel;
  return sendRequestToRoutes(ctx, channel.routes, next);
}

/*
 * The [Koa](http://koajs.com/) middleware function that enables the
 * router to work with the Koa framework.
 *
 * Use with: app.use(router.koaMiddleware)
 */
export function koaMiddleware(next) {
  let startTime;
  if (statsdServer.enabled) { startTime = new Date(); }
  let route = Q.denodeify(exports.route);
  ({}); //TODO:Fix yield route this
  if (statsdServer.enabled) { sdc.timing(`${domain}.routerMiddleware`, startTime); }
  return {}; //TODO:Fix yield next
}

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}