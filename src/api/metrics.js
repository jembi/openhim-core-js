import moment from "moment";
import logger from "winston";
import mongoose from "mongoose";
import Q from "q";
import _ from "lodash";
import { TransactionAPI } from "../model/transactions";
import { ChannelAPI } from "../model/channels";
import * as authorisation from "./authorisation";
import * as metrics from "../metrics";

// all in one getMetrics generator function for metrics API
export function* getMetrics(groupChannels, timeSeries, channelID) {
  let needle;
  logger.debug(`Called getMetrics(${groupChannels}, ${timeSeries}, ${channelID})`);
  const channels = yield authorisation.getUserViewableChannels(this.authenticated);
  let channelIDs = channels.map(c => c._id);
  if (typeof channelID === "string") {
    if (channelIDs.map(id => id.toString()).includes(channelID)) {
      channelIDs = [mongoose.Types.ObjectId(channelID)];
    } else {
      this.status = 401;
    }
  }

  let { query } = this.request;
  logger.debug(`Metrics query object: ${JSON.stringify(query)}`);
  const { startDate } = query;
  delete query.startDate;
  const { endDate } = query;
  delete query.endDate;

  if (Object.keys(query).length === 0) {
    query = null;
  }

  let m = yield metrics.calculateMetrics(new Date(startDate), new Date(endDate), query, channelIDs, timeSeries, groupChannels);
  if (m != null && m[0] != null && m[0]._id != null && m[0]._id.year != null) {
    m = m.map((item) => {
      const date = _.assign({}, item._id);
            // adapt for moment (month starting at 0)
      if (date.month) { date.month -= 1; }
      item.timestamp = moment.utc(date);
      return item;
    });
  }

  return this.body = m;
}
