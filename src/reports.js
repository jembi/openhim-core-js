// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import { EmailTemplate } from 'email-templates';
import logger from 'winston';
import moment from "moment";
import path from 'path';
import Q from 'q';

import authorisation from './api/authorisation';
import { Channel } from './model/channels';
import config from "./config/config";
config.reports = config.get('reports');
let contact = require('./contact');
let metrics = require('./metrics');
let { User } = require('./model/users');
let utils = require('./utils');

// Function Sends the reports
let sendReports = function(job, flag, done) {
  let fetchUsers, from, to;
  let reportMap = {};
  let channelReportMap = {};
  let channelMap = {};

  if (flag === 'dailyReport') {
    from = moment().subtract(1, 'days').startOf('day').toDate();
    to = moment().subtract(1, 'days').endOf('day').toDate();
  } else {
    from = moment().startOf('isoWeek').subtract(1, 'weeks').toDate();
    to = moment().endOf('isoWeek').subtract(1, 'weeks').toDate();
  }

  // Select the right subscribers for the report
  if (flag === 'dailyReport') {
    fetchUsers = fetchDailySubscribers;
  }
  if (flag === 'weeklyReport') {
    fetchUsers = fetchWeeklySubscribers;
  }

  return fetchUsers(function(err, users) {
    let promises = [];
    let userKey = '';
    let userIndex = 0;
    let usersArray = [];
    for (var user of Array.from(users)) {
      (function(user) {
        let deferred = Q.defer();
        userKey = user.email;
        authorisation.getUserViewableChannels(user)
        .then(function(channels) {
          usersArray[userIndex] = user;
          usersArray[userIndex].allowedChannels = channels;
          for (let channel of Array.from(usersArray[userIndex].allowedChannels)) {
            channelMap[channel._id] = {
              user,
              channel
            };
          }

          userIndex++;
          return deferred.resolve();
        });

        return promises.push(deferred.promise);
      })(user);
    }

    // Loop through the enriched user array
    let innerPromises = [];
    return (Q.all(promises)).then(function() {
      // Pre-Fetch report data into Channel Map
      for (var key in channelMap) {
        let obj = channelMap[key];
        let innerDeferred = Q.defer();
        ((innerDeferred, key, obj) =>
          fetchChannelReport(obj.channel, obj.user, flag, from, to, function(err, item) {
            channelReportMap[key] = item;
            return innerDeferred.resolve();
          })
        )(innerDeferred, key, obj);

        innerPromises.push(innerDeferred.promise);
      }

      return (Q.all(innerPromises)).then(function() {
        for (user of Array.from(usersArray)) {
          userKey = user.email;
          for (let channel of Array.from(user.allowedChannels)) {
            (function(channel) {
              if (reportMap[userKey]) {
                // Do nothing since object already exists
              } else {
                // Create the object
                reportMap[userKey] = {
                  email: user.email,
                  data: []
                };
              }

              // If report has been fetched get it from the map
              if (channelReportMap[channel._id]) {
                let data = channelReportMap[channel._id];
                // add report - always add if the channel is enabled (treating undefined status as enabled), otherwise only if there is data
                if ((data.channel.status == null) || (data.channel.status === 'enabled') || (data.data.length !== 0)) {
                  return reportMap[userKey].data.push(data);
                }
              } else {
                return logger.error('should never be here since channels have been pre-fetched');
              }
            })(channel);
          }
        }

        // Iterate over reports and send the emails
        for (key in reportMap) {
          let report = reportMap[key];
          if (flag === 'dailyReport') {
            report.type = 'Daily';
            report.isDaily = true;
          } else {
            report.type = 'Weekly';
            report.isDaily = false;
          }

          report.instance = config.alerts.himInstance;
          report.consoleURL = config.alerts.consoleURL;

          report.from = moment(from).format('YYYY-MM-DD');
          report.to = moment(to).format('YYYY-MM-DD');

          try {
            for (let i = 0; i < report.data.length; i++) {
              let data = report.data[i];
              let colorGrey = 'color: grey;';
              let rowColor = 'background-color: #d9ead3';
              if (i % 2) {
                rowColor = 'background-color: #b6d7a8;';
              }
              
              let totals = calculateTotalsFromGrouping(data);
              for (key in totals) {
                let value = totals[key];
                report.data[i][key] = totals[key];
              }
              
              report.data[i].totalStyle = (report.data[i].total > 0 ? '' : colorGrey);
              report.data[i].avgRespStyle = (report.data[i].avgResp > 0 ? '' : colorGrey);
              report.data[i].failedStyle = (report.data[i].failed > 0 ? 'color: red;' : colorGrey);
              report.data[i].successfulStyle = (report.data[i].successful > 0 ? '' : colorGrey);
              report.data[i].processingStyle = (report.data[i].processing > 0 ? '' : colorGrey);
              report.data[i].completedStyle = (report.data[i].completed > 0 ? 'color: orange;' : colorGrey);
              report.data[i].completedWErrorsStyle = (report.data[i].completedWErrors > 0 ? 'color: orangered;' : colorGrey);
              report.data[i].rowColor = rowColor;
            }

            sendUserEmail(report);
          } catch (err) {
            logger.error(err);
            job.fail(`Failed to send report reason: ${err}`);
          }
        }

        return done();
      });
    });
  });
};

var calculateTotalsFromGrouping = function(data) {
  let totals = {
    total: 0,
    avgResp: 0,
    failed: 0,
    successful: 0,
    processing: 0,
    completed: 0,
    completedWErrors: 0
  };

  data.data.forEach((val, index) =>
    (() => {
      let result = [];
      for (let key in totals) {
        let value = totals[key];
        if (key === 'avgResp') {
          result.push(totals[key] += (((data.data[index] != null ? data.data[index][key] : undefined) != null) ? Math.round(data.data[index][key])/1000 : 0));
        } else {
          result.push(totals[key] += (((data.data[index] != null ? data.data[index][key] : undefined) != null) ? data.data[index][key] : 0));
        }
      }
      return result;
    })()
  );
  
  return totals;
};
  

var sendUserEmail = function(report) {
  report.date = new Date().toString();
  return renderTemplate('report', report, reportHtml => contact.contactUser('email', report.email, report.type + ' report for: ' + report.instance, plainTemplate(report), reportHtml, afterEmail));
};


var fetchChannelReport = function(channel, user, flag, from, to, callback) {
  let period;
  if (flag === 'dailyReport') {
    period = 'day';
  } else {
    period = 'week';
  }

  let item = {};

  logger.info(`fetching ${flag} for #${channel.name} ${user.email} ${channel._id}`);

  return metrics.calculateMetrics(from, to, null, [channel._id], period)
  .then(function(data) {
    item.channel = channel;
    item.data = data;
    return callback(null, item);}).catch(function(err) {
    logger.error('Error calculating metrics: ', err);
    return callback(err);
  });
};

var fetchDailySubscribers = callback => User.find({ dailyReport: true }, callback);

var fetchWeeklySubscribers = callback => User.find({ weeklyReport: true }, callback);

var plainTemplate = function(report) {
  let text = `Generated on: ${new Date().toString()}`;
  for (let data of Array.from(report.data)) {
    (data =>
      text += ` \r\n \r\n <---------- Start Channel  ${data.channel.name} ---------------------------> \r\n \r\n \
Channel Name: ${data.channel.name} \r\n \
Channel total: ${ ((data.data[0] != null ? data.data[0].total : undefined) != null) ? data.data[0].total : 0} transactions  \r\n \
Ave response time: ${ ((data.data[0] != null ? data.data[0].avgResp : undefined) != null) ? data.data[0].avgResp  : 0 } \r\n \
Failed:  ${ ((data.data[0] != null ? data.data[0].failed : undefined) != null) ? data.data[0].failed  : 0 }  \r\n \
Successful:  ${ ((data.data[0] != null ? data.data[0].successful : undefined) != null) ? data.data[0].successful  : 0 }  \r\n \
Processing: ${ ((data.data[0] != null ? data.data[0].processing : undefined) != null) ? data.data[0].processing  : 0 }  \r\n \
Completed:  ${ ((data.data[0] != null ? data.data[0].completed : undefined) != null) ? data.data[0].completed  : 0 }  \r\n \
Completed with errors: ${ ((data.data[0] != null ? data.data[0].completedWErrors : undefined) != null) ? data.data[0].completedWErrors : 0 } \r\n \r\n \
<---------- End Channel -------------------------------------------------> \r\n \r\n \
\r\n \
\r\n\
`
    )(data);
  }
  return text;
};

var renderTemplate = function(templateName, templateData, callback) {
  let templateDir = `${appRoot}/templates/${templateName}`;
  let template = new EmailTemplate(templateDir);
  return template.render(templateData, function(err, result) {
    if (err) {
      logger.err(err);
    }
    return callback(result.html.toString());
  });
};


var afterEmail = callback => logger.info('email sent..');


let setupAgenda = function(agenda) {
  agenda.define('send weekly channel metrics', (job, done) => sendReports(job, 'weeklyReport', done));

  agenda.define('send daily channel metrics', (job, done) => sendReports(job, 'dailyReport', done));

  agenda.every(config.reports.weeklyReportAt, 'send weekly channel metrics', null, { timezone: utils.serverTimezone() });
  return agenda.every(config.reports.dailyReportAt, 'send daily channel metrics', null, { timezone: utils.serverTimezone() });
};


export { setupAgenda };

if (process.env.NODE_ENV === "test") {
  exports.sendReports = sendReports;
  exports.fetchDailySubscribers = fetchDailySubscribers;
  exports.fetchWeeklySubscribers = fetchWeeklySubscribers;
  exports.fetchChannelReport = fetchChannelReport;
  exports.sendUserEmail = sendUserEmail;
  exports.calculateTotalsFromGrouping = calculateTotalsFromGrouping;
}
