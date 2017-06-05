// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import auth from 'basic-auth';
import Q from "q";
import { Client } from "../model/clients";
import logger from "winston";
import crypto from "crypto";

import bcrypt from 'bcryptjs';

import config from '../config/config';
let statsdServer = config.get('statsd');
let application = config.get('application');
const SDC = require('statsd-client');
let os = require('os');

let domain = `${os.hostname()}.${application.name}.appMetrics`;
let sdc = new SDC(statsdServer);

let bcryptCompare = (pass, client, callback) => bcrypt.compare(pass, client.passwordHash, callback);

 function cryptoCompare(pass, client, callback) {
  let hash = crypto.createHash(client.passwordAlgorithm);
  hash.update(pass);
  hash.update(client.passwordSalt);
  if (hash.digest('hex') === client.passwordHash) {
    return callback(null, true);
  } else {
    return callback(null, false);
  }
};

 function comparePasswordWithClientHash(pass, client, callback) {
  let needle;
  if ((needle = client.passwordAlgorithm, Array.from(crypto.getHashes()).includes(needle))) {
    return cryptoCompare(pass, client, callback);
  } else {
    return bcryptCompare(pass, client, callback);
  }
};


export function authenticateUser(ctx, done) {
  let user = auth(ctx);

  if (user) {
    return Client.findOne({ clientID: user.name }, function(err, client) {
      if (err) { return done(err); }

      if (client) {
        if (!(client.passwordAlgorithm && client.passwordHash)) {
          logger.warn(`${user.name} does not have a basic auth password set`);
          return done(null, null);
        }

        return comparePasswordWithClientHash(user.pass, client, function(err, res) {
          if (err) { return done(err); }

          if (res) {
            logger.info(`${user.name} is authenticated.`);
            ctx.authenticated = client;
            ctx.authenticationType = 'basic';
            return done(null, client);
          } else {
            logger.info(`${user.name} could NOT be authenticated, trying next auth mechanism if any...`);
            return done(null, null);
          }
        });
      } else {
        logger.info(`${user.name} not found, trying next auth mechanism if any...`);
        return done(null, null);
      }
    });
  } else {
    logger.info("No basic auth details supplied, trying next auth mechanism if any...");
    ctx.authenticated = null; // Set to empty object rather than null
    return done(null, null);
  }
}

/*
 * Koa middleware for authentication by basic auth
 */
export function koaMiddleware(next) {
  let startTime;
  if (statsdServer.enabled) { startTime = new Date(); }
  if (this.authenticated != null) {
    return {}; //TODO:Fix yield next
  } else {
    let authenticateUser = Q.denodeify(exports.authenticateUser);
    ({}); //TODO:Fix yield authenticateUser this
    if ((this.authenticated != null ? this.authenticated.clientID : undefined) != null) {
      this.header['X-OpenHIM-ClientID'] = this.authenticated.clientID;
    }
    if (statsdServer.enabled) { sdc.timing(`${domain}.basicAuthMiddleware`, startTime); }
    return {}; //TODO:Fix yield next
  }
}
