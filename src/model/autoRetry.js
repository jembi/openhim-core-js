import { Schema } from "mongoose";
import { connectionDefault } from "../config";

const AutoRetrySchema = new Schema({
  transactionID: {
    type: Schema.Types.ObjectId, required: true
  },
  channelID: {
    type: Schema.Types.ObjectId, required: true
  },
  requestTimestamp: {
    type: Date, required: true
  }
});

export const AutoRetry = connectionDefault.model("AutoRetry", AutoRetrySchema);
