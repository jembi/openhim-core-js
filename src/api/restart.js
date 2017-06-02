import logger from 'winston';
import authorisation from '../api/authorisation';
import server from "../server";
import config from "../config/config";
config.router = config.get('router');
config.api = config.get('api');
config.rerun = config.get('rerun');
config.polling = config.get('polling');
config.tcpAdapter = config.get('tcpAdapter');
let { Keystore } = require('../model/keystore');
let KeystoreAPI = require("../api/keystore");
let utils = require("../utils");
const Q = require('q');

/*
 * restart the server
 */
export function restart(next) {
  // Test if the user is authorised
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to restart the server denied.`, 'info');
    return;
  }

  try {
    let emailAddr = this.authenticated.email;

    let result = {}; //TODO:Fix yield Q.nfcall KeystoreAPI.getCertKeyStatus

    // valid certificate/key
    if (result) {
      server.startRestartServerTimeout(() => logger.info(`User ${emailAddr} has requested a Server Restart. Proceeding to restart servers...`));

      // All ok! So set the result
      this.body = 'Server being restarted';
      return this.status = 200;
    } else {
      // Not valid
      logger.info(`User ${emailAddr} has requested a Server Restart with invalid certificate details. Cancelling restart...`);
      this.body = 'Certificates and Key did not match. Cancelling restart...';
      return this.status = 400;
    }

  } catch (e) {
    return utils.logAndSetResponse(this, 400, `Could not restart the servers via the API: ${e}`, 'error');
  }
}