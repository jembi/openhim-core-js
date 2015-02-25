mongoose = require "mongoose"
Schema = mongoose.Schema

eventIdSchema = new Schema
  "code": { type: String, required: false }
  "codeSystemName": { type: String, required: false }
  "displayName": { type: String, required: false }

auditRecordSchema = new Schema
  "EventIdentification":
    "EventDateTime": { type: Date, required: true, default: Date.now }
    "EventOutcomeIndicator": { type: String, required: false }
    "EventActionCode": { type: String, required: false }
    "EventID": eventIdSchema