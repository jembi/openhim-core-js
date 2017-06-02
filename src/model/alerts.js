// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import mongoose from "mongoose";
import server from "../server";
let { connectionDefault } = server;
let { Schema } = mongoose;

// A collection for keeping a day-long log of any alerts that got sent out to users
// It is used for the user max-alert policies
let AlertSchema = new Schema({
  "user": {         type: String, required: true
},
  "method": {       type: String, required: true
},
  "timestamp": {    type: Date, required: true, default: Date.now, expires: '1d'
},
  "channelID": {    type: String, required: true
},
  "condition": {    type: String, required: true
},
  "status": {       type: String, required: true
},
  "alertStatus": {  type: String, required: true, enum: ["Failed", "Completed"]
}});
 
export let Alert = connectionDefault.model('Alert', AlertSchema);
