// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
let ContactUserDef;
import mongoose from "mongoose";
import server from "../server";
let { connectionDefault } = server;
let { Schema } = mongoose;

let ContactUserDef$1 = (ContactUserDef = {
  "user": {       type: String, required: true
},
  "method": {     type: String, required: true, enum: ["email", "sms" ]
},
  "maxAlerts": {  type: String, enum: ["no max", "1 per hour", "1 per day" ], default: "no max"
}
});

export { ContactUserDef$1 as ContactUserDef };
let ContactGroupSchema = new Schema({
  "group": {      type: String, required: true, unique: true
},
  "users":      [ContactUserDef]});
 
export let ContactGroup = connectionDefault.model('ContactGroup', ContactGroupSchema);
