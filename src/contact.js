// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
let contactUser;
import logger from "winston";
import nodemailer from "nodemailer";
import request from "request";
import config from "./config/config";
config.email = config.get('email');
config.nodemailer = config.get('nodemailer');
config.smsGateway = config.get('smsGateway');

export function sendEmail(contactAddress, title, messagePlain, messageHTML, callback) {

  let nodemailerConfig = null;
  let fromAddress = null;

  if (config.email) {
    nodemailerConfig = config.email.nodemailer;
    ({ fromAddress } = config.email);
  } else if (config.nodemailer) {
    // Support old config format for backwards compatibility
    nodemailerConfig = config.nodemailer;
    fromAddress = nodemailerConfig.auth.user;
  } else {
    return callback(new Error("No email config found"));
  }

  logger.info(`Sending email to '${contactAddress}' using service ` +
    `${nodemailerConfig.service} - ${fromAddress}`
  );
  let smtpTransport = nodemailer.createTransport(nodemailerConfig);

  return smtpTransport.sendMail({
    from: fromAddress,
    to: contactAddress,
    subject: title,
    text: messagePlain,
    html: messageHTML
  }, (error, response) => callback(error != null ? error : null));
}

 function sendSMS(contactAddress, message, callback) {
  if (config.smsGateway.provider === 'clickatell') {
    return sendSMS_Clickatell(contactAddress, message, callback);
  } else {
    return callback(`Unknown SMS gateway provider '${config.smsGateway.provider}'`);
  }
};

var sendSMS_Clickatell = function(contactAddress, message, callback) {
  logger.info(`Sending SMS to '${contactAddress}' using Clickatell`);
  return request(`http://api.clickatell.com/http/sendmsg?api_id=${config.smsGateway.config.apiID}&` +
      `user=${config.smsGateway.config.user}&password=${config.smsGateway.config.pass}&` +
      `to=${contactAddress}&text=${escapeSpaces(message)}`, function(err, response, body) {
    if (body != null) { logger.info(`Received response from Clickatell: ${body}`); }
    return callback(err != null ? err : null);
  });
};


var escapeSpaces = str => str.replace(' ', '+');

/*
 * Send a message to a user using a specific method. Current supported methods are 'email' and 'sms'.
 * contactAddress should contain an email address if the method is 'email' and an MSISDN if the method is 'sms'.
 *
 * The contents of the message should be passed via messagePlain.
 * messageHTML is optional and is only used by the 'email' method.
 */
let contactUser$1 = (contactUser = function(method, contactAddress, title, messagePlain, messageHTML, callback) {
  if (method === 'email') {
    return exports.sendEmail(contactAddress, title, messagePlain, messageHTML, callback);
  } else if (method === 'sms') {
    return sendSMS(contactAddress, messagePlain, callback);
  } else {
    return callback(`Unknown contact method '${method}'`);
  }
});
export { contactUser$1 as contactUser };
