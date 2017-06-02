// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import mongoose from "mongoose";
import server from "../server";
let { connectionDefault } = server;
let { Schema } = mongoose;

let UserSchema = new Schema({
  "firstname": {          type: String, required: true
},
  "surname": {            type: String, required: true
},
  "email": {              type: String, required: true, unique: true
},
  "passwordAlgorithm":  String,
  "passwordHash":       String,
  "passwordSalt":       String,
  "groups":             [String],
  "msisdn":             String,
  "dailyReport":        Boolean,
  "weeklyReport":       Boolean,
  "settings":           Object,
  "token":              String,
  "tokenType": {
    type:     String,
    enum:     ['newUser', 'existingUser', null]
  }, // null is needed as we used nulls to clear to token and tokenType
  "expiry":             Date,
  "locked":             Boolean
});

//compile the User Schema into a Model
export let User = connectionDefault.model('User', UserSchema);
