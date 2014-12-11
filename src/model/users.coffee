mongoose = require "mongoose"
Schema = mongoose.Schema

UserSchema = new Schema
  "firstname":    { type: String, required: true }
  "surname":        { type: String, required: true }
  "email":        { type: String, required: true, unique: true }
  "passwordAlgorithm":{ type: String, required: false }
  "passwordHash":   { type: String, required: false }
  "passwordSalt":   { type: String, required: false }
  "groups":       [ { type: String, required: false } ]
  "msisdn":        { type: String, required: false }
  "dailyReport":    { type: Boolean, required: false }
  "weeklyReport":    { type: Boolean, required: false }
  "settings":      { type: Object }
  "token":      { type: String, required: false }
  "expiry":      { type: Date, required: false }
  "locked":      { type: Boolean, required: false }
  
#compile the User Schema into a Model
exports.User = mongoose.model 'User', UserSchema
