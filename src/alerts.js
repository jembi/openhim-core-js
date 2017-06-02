// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import config from "./config/config";
config.alerts = config.get('alerts');
let logger = require("winston");
let contact = require('./contact');
let moment = require('moment');
const Q = require('q');
let Channels = require('./model/channels');
let { Channel } = Channels;
let { Event } = require('./model/events');
let { ContactGroup } = require('./model/contactGroups');
let { Alert } = require('./model/alerts');
let { User } = require('./model/users');
let authorisation = require('./middleware/authorisation');
let utils = require('./utils');
let _ = require('lodash');


let trxURL = trx => `${config.alerts.consoleURL}/#/transactions/${trx.transactionID}`;

let statusTemplate = (transactions, channel, alert) =>
  ({
    plain() {
      return `\
OpenHIM Transactions Alert

The following transaction(s) have completed with status ${alert.status} on the OpenHIM instance running on ${config.alerts.himInstance}:
Channel - ${channel.name}
${(transactions.map(trx => trxURL(trx))).join('\n')}
\
`;
    },
    html() {
      let text = `\
<html>
    <head></head>
    <body>
      <h1>OpenHIM Transactions Alert</h1>
      <div>
        <p>The following transaction(s) have completed with status <b>${alert.status}</b> on the OpenHIM instance running on <b>${config.alerts.himInstance}</b>:</p>
        <table>
          <tr><td>Channel - <b>${channel.name}</b></td></td>\n\
`;
      text += (transactions.map(trx => `        <tr><td><a href='${trxURL(trx)}'>${trxURL(trx)}</a></td></tr>`)).join('\n');
      text += '\n';
      return text += `\
        </table>
      </div>
    </body>
</html>\
`;
    },
    sms() {
      let text = "Alert - ";
      if (transactions.length > 1) {
        text += `${transactions.length} transactions have`;
      } else if (transactions.length === 1) {
        text += "1 transaction has";
      } else {
        text += "no transactions have";
      }
      return text += ` completed with status ${alert.status} on the OpenHIM running on ${config.alerts.himInstance} (${channel.name})`;
    }
  })
;


let maxRetriesTemplate = (transactions, channel, alert) =>
  ({
    plain() {
      return `\
OpenHIM Transactions Alert - ${config.alerts.himInstance}

The following transaction(s) have been retried ${channel.autoRetryMaxAttempts} times, but are still failing:

Channel - ${channel.name}
${(transactions.map(trx => trxURL(trx))).join('\n')}

Please note that they will not be retried any further by the OpenHIM automatically.\
`;
    },
    html() {
      let text = `\
<html>
    <head></head>
    <body>
      <h1>OpenHIM Transactions Alert - ${config.alerts.himInstance}</h1>
      <div>
        <p>The following transaction(s) have been retried <b>${channel.autoRetryMaxAttempts}</b> times, but are still failing:</p>
        <table>
          <tr><td>Channel - <b>${channel.name}</b></td></td>\n\
`;
      text += (transactions.map(trx => `        <tr><td><a href='${trxURL(trx)}'>${trxURL(trx)}</a></td></tr>`)).join('\n');
      text += '\n';
      return text += `\
        </table>
        <p>Please note that they will not be retried any further by the OpenHIM automatically.</p>
      </div>
    </body>
</html>\
`;
    },
    sms() {
      let text = "Alert - ";
      if (transactions.length > 1) {
        text += `${transactions.length} transactions have`;
      } else if (transactions.length === 1) {
        text += "1 transaction has";
      }
      return text += ` been retried ${channel.autoRetryMaxAttempts} times but are still failing on the OpenHIM on ${config.alerts.himInstance} (${channel.name})`;
    }
  })
;


let getAllChannels = callback => Channel.find({}, callback);

let findGroup = (groupID, callback) => ContactGroup.findOne({_id: groupID}, callback);

let findTransactions = (channel, dateFrom, status, callback) =>
  Event
    .find({
      created: { $gte: dateFrom
    },
      channelID: channel._id,
      event: 'end',
      status,
      type: 'channel'
    }, { 'transactionID': 'transactionID' })
    .hint({created: 1})
    .exec(callback)
;

let countTotalTransactionsForChannel = (channel, dateFrom, callback) =>
  Event.count({
    created: { $gte: dateFrom
  },
    channelID: channel._id,
    type: 'channel',
    event: 'end'
  }, callback)
;

let findOneAlert = function(channel, alert, dateFrom, user, alertStatus, callback) {
  let criteria = {
    timestamp: { "$gte": dateFrom },
    channelID: channel._id,
    condition: alert.condition,
    status: alert.condition === 'auto-retry-max-attempted' ? '500' : alert.status,
    alertStatus
  };
  if (user) { criteria.user = user; }
  return Alert
    .findOne(criteria)
    .exec(callback);
};


let findTransactionsMatchingCondition = function(channel, alert, dateFrom, callback) {
  if (!alert.condition || (alert.condition === 'status')) {
    return findTransactionsMatchingStatus(channel, alert, dateFrom, callback);
  } else if (alert.condition === 'auto-retry-max-attempted') {
    return findTransactionsMaxRetried(channel, alert, dateFrom, callback);
  } else {
    return callback(new Error(`Unsupported condition '${alert.condition}'`));
  }
};

var findTransactionsMatchingStatus = function(channel, alert, dateFrom, callback) {
  let statusMatch;
  let pat = /\dxx/.exec(alert.status);
  if (pat) {
    statusMatch = {"$gte": alert.status[0]*100, "$lt": (alert.status[0]*100)+100};
  } else {
    statusMatch = alert.status;
  }

  let dateToCheck = dateFrom;
  // check last hour when using failureRate
  if (alert.failureRate != null) { dateToCheck = moment().subtract(1, 'hours').toDate(); }

  return findTransactions(channel, dateToCheck, statusMatch, function(err, results) {
    if (!err && (results != null) && (alert.failureRate != null)) {
      // Get count of total transactions and work out failure ratio
      let _countStart = new Date();
      return countTotalTransactionsForChannel(channel, dateToCheck, function(err, count) {
        logger.debug(`.countTotalTransactionsForChannel: ${new Date()-_countStart} ms`);

        if (err) { return callback(err, null); }

        let failureRatio = (results.length/count)*100.0;
        if (failureRatio >= alert.failureRate) {
          return findOneAlert(channel, alert, dateToCheck, null, 'Completed', function(err, userAlert) {
            if (err) { return callback(err, null); }
            // Has an alert already been sent this last hour?
            if (userAlert != null) {
              return callback(err, []);
            } else {
              return callback(err, utils.uniqArray(results));
            }
          });
        } else {
          return callback(err, []);
        }
    });
    } else {
      return callback(err, results);
    }
  });
};

var findTransactionsMaxRetried = (channel, alert, dateFrom, callback) =>
  Event
    .find({
      created: { $gte: dateFrom
    },
      channelID: channel._id,
      event: 'end',
      type: 'channel',
      status: 500,
      autoRetryAttempt: channel.autoRetryMaxAttempts
    }, { 'transactionID': 'transactionID' })
    .hint({created: 1})
    .exec(function(err, transactions) {
      if (err) { return callback(err); }
      return callback(null, _.uniqWith(transactions, (a, b) => a.transactionID.equals(b.transactionID)));
  })
;

let calcDateFromForUser = function(user) {
  let dateFrom;
  if (user.maxAlerts === '1 per hour') {
    return dateFrom = moment().subtract(1, 'hours').toDate();
  } else if (user.maxAlerts === '1 per day') {
    return dateFrom = moment().startOf('day').toDate();
  } else {
    return null;
  }
};

let userAlreadyReceivedAlert = function(channel, alert, user, callback) {
  if (!user.maxAlerts || (user.maxAlerts === 'no max')) {
    // user gets all alerts
    return callback(null, false);
  } else {
    let dateFrom = calcDateFromForUser(user);
    if (!dateFrom) { return callback(`Unsupported option 'maxAlerts=${user.maxAlerts}'`); }

    return findOneAlert(channel, alert, dateFrom, user.user, 'Completed', (err, userAlert) => callback(err != null ? err : null, userAlert ? true : false));
  }
};

// Setup the list of transactions for alerting.
//
// Fetch earlier transactions if a user is setup with maxAlerts.
// If the user has no maxAlerts limit, then the transactions object is returned as is.
let getTransactionsForAlert = function(channel, alert, user, transactions, callback) {
  if (!user.maxAlerts || (user.maxAlerts === 'no max')) {
    return callback(null, transactions);
  } else {
    let dateFrom = calcDateFromForUser(user);
    if (!dateFrom) { return callback(`Unsupported option 'maxAlerts=${user.maxAlerts}'`); }

    return findTransactionsMatchingCondition(channel, alert, dateFrom, callback);
  }
};

let sendAlert = (channel, alert, user, transactions, contactHandler, done) =>
  User.findOne({ email: user.user }, function(err, dbUser) {
    if (err) { return done(err); }
    if (!dbUser) { return done(`Cannot send alert: Unknown user '${user.user}'`); }

    return userAlreadyReceivedAlert(channel, alert, user, function(err, received) {
      if (err) { return done(err, true); }
      if (received) { return done(null, true); }

      logger.info(`Sending alert for user '${user.user}' using method '${user.method}'`);

      return getTransactionsForAlert(channel, alert, user, transactions, function(err, transactionsForAlert) {
        let template = statusTemplate(transactionsForAlert, channel, alert);
        if (alert.condition === 'auto-retry-max-attempted') {
          template = maxRetriesTemplate(transactionsForAlert, channel, alert);
        }

        if (user.method === 'email') {
          let plainMsg = template.plain();
          let htmlMsg = template.html();
          return contactHandler('email', user.user, 'OpenHIM Alert', plainMsg, htmlMsg, done);
        } else if (user.method === 'sms') {
          if (!dbUser.msisdn) { return done(`Cannot send alert: MSISDN not specified for user '${user.user}'`); }

          let smsMsg = template.sms();
          return contactHandler('sms', dbUser.msisdn, 'OpenHIM Alert', smsMsg, null, done);
        } else {
          return done(`Unknown method '${user.method}' specified for user '${user.user}'`);
        }
      });
    });
  })
;

// Actions to take after sending an alert
let afterSendAlert = function(err, channel, alert, user, transactions, skipSave, done) {
  if (err) { logger.error(err); }

  if (!skipSave) {
    alert = new Alert({
      user: user.user,
      method: user.method,
      channelID: channel._id,
      condition: alert.condition,
      status: alert.condition === 'auto-retry-max-attempted' ? '500' : alert.status,
      alertStatus: err ? 'Failed' : 'Completed'
    });

    return alert.save(function(err) {
      if (err) { logger.error(err); }
      return done();
    });
  } else {
    return done();
  }
};

let sendAlerts = function(channel, alert, transactions, contactHandler, done) {
  // Each group check creates one promise that needs to be resolved.
  // For each group, the promise is only resolved when an alert is sent and stored
  // for each user in that group. This resolution is managed by a promise set for that group.
  //
  // For individual users in the alert object (not part of a group),
  // a promise is resolved per user when the alert is both sent and stored.
  let promises = [];

  let _alertStart = new Date();
  if (alert.groups) {
    for (let group of Array.from(alert.groups)) {
      var groupDefer = Q.defer();
      findGroup(group, function(err, result) {
        if (err) {
          logger.error(err);
          return groupDefer.resolve();
        } else {
          let groupUserPromises = [];

          for (let user of Array.from(result.users)) {
            (function(user) {
              let groupUserDefer = Q.defer();
              sendAlert(channel, alert, user, transactions, contactHandler, (err, skipSave) => afterSendAlert(err, channel, alert, user, transactions, skipSave, () => groupUserDefer.resolve()));
              return groupUserPromises.push(groupUserDefer.promise);
            })(user);
          }

          return (Q.all(groupUserPromises)).then(() => groupDefer.resolve());
        }
      });
      promises.push(groupDefer.promise);
    }
  }

  if (alert.users) {
    for (let user of Array.from(alert.users)) {
      (function(user) {
        let userDefer = Q.defer();
        sendAlert(channel, alert, user, transactions, contactHandler, (err, skipSave) => afterSendAlert(err, channel, alert, user, transactions, skipSave, () => userDefer.resolve()));
        return promises.push(userDefer.promise);
      })(user);
    }
  }

  return (Q.all(promises)).then(function() {
    logger.debug(`.sendAlerts: ${new Date()-_alertStart} ms`);
    return done();
  });
};


let alertingTask = function(job, contactHandler, done) {
  if (!job.attrs.data) { job.attrs.data = {}; }

  let lastAlertDate = job.attrs.data.lastAlertDate != null ? job.attrs.data.lastAlertDate : new Date();

  let _taskStart = new Date();
  return getAllChannels(function(err, results) {
    let promises = [];

    for (let channel of Array.from(results)) {
      if (Channels.isChannelEnabled(channel)) {

        for (let alert of Array.from(channel.alerts)) {
          (function(channel, alert) {
            let deferred = Q.defer();

            let _findStart = new Date();
            findTransactionsMatchingCondition(channel, alert, lastAlertDate, function(err, results) {
              logger.debug(`.findTransactionsMatchingStatus: ${new Date()-_findStart} ms`);

              if (err) {
                logger.error(err);
                return deferred.resolve();
              } else if ((results != null) && (results.length>0)) {
                return sendAlerts(channel, alert, results, contactHandler, () => deferred.resolve());
              } else {
                return deferred.resolve();
              }
            });

            return promises.push(deferred.promise);
          })(channel, alert);
        }
      }
    }

    return (Q.all(promises)).then(function() {
      job.attrs.data.lastAlertDate = new Date();
      logger.debug(`Alerting task total time: ${new Date()-_taskStart} ms`);
      return done();
    });
  });
};


let setupAgenda = function(agenda) {
  agenda.define('generate transaction alerts', (job, done) => alertingTask(job, contact.contactUser, done));
  return agenda.every(`${config.alerts.pollPeriodMinutes} minutes`, 'generate transaction alerts');
};


export { setupAgenda };

if (process.env.NODE_ENV === "test") {
  exports.findTransactionsMatchingStatus = findTransactionsMatchingStatus;
  exports.findTransactionsMaxRetried = findTransactionsMaxRetried;
  exports.alertingTask = alertingTask;
}
