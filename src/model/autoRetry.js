// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import mongoose from 'mongoose';
import server from '../server';
let { connectionDefault } = server;
let { Schema } = mongoose;

let AutoRetrySchema = new Schema({
  "transactionID": {    type: Schema.Types.ObjectId, required: true
},
  "channelID": {        type: Schema.Types.ObjectId, required: true
},
  "requestTimestamp": { type: Date, required: true
}
});

export let AutoRetry = connectionDefault.model('AutoRetry', AutoRetrySchema);
