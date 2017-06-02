let removePollingChannel;
import Channels from './model/channels';
let { Channel } = Channels;
import request from 'request';
import config from './config/config';
config.polling = config.get('polling');
let logger = require('winston');
const Q = require('q');
let authorisation = require('./middleware/authorisation');
let utils = require('./utils');

export let agendaGlobal = null;

export function registerPollingChannel(channel, callback) {
  logger.info(`Registering polling channel: ${channel._id}`);
  if (!channel.pollingSchedule) { return callback(new Error('no polling schedule set on this channel')); }

  return exports.agendaGlobal.cancel({ name: `polling-job-${channel._id}` }, function(err) {
    if (err) { return callback(err); }
    exports.agendaGlobal.define(`polling-job-${channel._id}`, function(job, done) {
      logger.info(`Polling channel ${channel._id}`);

      let options = {
        url: `http://${config.polling.host}:${config.polling.pollingPort}/trigger`,
        headers: {
          'channel-id': channel._id,
          'X-OpenHIM-LastRunAt': job.attrs.lastRunAt
        }
      };

      return request(options, () => done());
    });

    exports.agendaGlobal.every(channel.pollingSchedule, `polling-job-${channel._id}`, null, { timezone: utils.serverTimezone() });

    return callback(null);
  });
}

let removePollingChannel$1 = (removePollingChannel = function(channel, callback) {
  logger.info(`Removing polling schedule for channel: ${channel._id}`);
  return exports.agendaGlobal.cancel({ name: `polling-job-${channel._id}` }, function(err) {
    if (err) { return callback(err); }
    return callback(null);
  });
});

export { removePollingChannel$1 as removePollingChannel };
export function setupAgenda(agenda, callback) {
  logger.info("Starting polling server...");
  let registerPollingChannelPromise = Q.denodeify(exports.registerPollingChannel);
  exports.agendaGlobal = agenda;
  return Channel.find({ type: 'polling' }, function(err, channels) {
    if (err) { return err; }

    let promises = [];
    for (let channel of Array.from(channels)) {
      if (Channels.isChannelEnabled(channel)) {
        promises.push(registerPollingChannelPromise(channel));
      }
    }

    return (Q.all(promises)).done(callback);
  });
}
