// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import { Transaction } from '../model/transactions';
import { Channel } from '../model/channels';
import moment from 'moment';
import logger from 'winston';
import mongoose from 'mongoose';
import authorisation from './authorisation';
import Q from 'q';
import metrics from "../metrics";
import _ from 'lodash';

// all in one getMetrics generator function for metrics API
export function getMetrics(groupChannels, timeSeries, channelID) {
  let needle;
  logger.debug(`Called getMetrics(${groupChannels}, ${timeSeries}, ${channelID})`);
  let channels = {}; //TODO:Fix yield authorisation.getUserViewableChannels this.authenticated
  let channelIDs = channels.map(c => c._id);
  if ((typeof channelID === 'string') && !((needle = channelID, Array.from((channelIDs.map(id => id.toString()))).includes(needle)) )) {
    this.status = 401;
    return;
  } else if (typeof channelID === 'string') {
    channelIDs = [mongoose.Types.ObjectId(channelID)];
  }

  let { query } = this.request;
  logger.debug(`Metrics query object: ${JSON.stringify(query)}`);
  let { startDate } = query;
  delete query.startDate;
  let { endDate } = query;
  delete query.endDate;

  if (Object.keys(query).length === 0) {
    query = null;
  }

  let m = {}; //TODO:Fix yield metrics.calculateMetrics new Date(startDate), new Date(endDate), query, channelIDs, timeSeries, groupChannels

  if (__guard__(m[0] != null ? m[0]._id : undefined, x => x.year) != null) { // if there are time components
    m = m.map(function(item) {
      let date = _.assign({}, item._id);
      // adapt for moment (month starting at 0)
      if (date.month) { date.month = date.month - 1; }
      item.timestamp = moment.utc(date);
      return item;
    });
  }

  return this.body = m;
}

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}