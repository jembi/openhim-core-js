// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import mongoose from "mongoose";
import server from "../server";
let { connectionDefault } = server;
let { Schema } = mongoose;

let TaskSchema = new Schema({
  "status": {
    type:      String,
    required:  true,
    enum:      ["Queued", "Processing", "Paused", "Cancelled", "Completed"],
    default:   "Queued",
    index:     true
  },
  "transactions": [{
    tid: {        type: String, required: true
  },
    tstatus: {
      type:     String,
      required: true,
      enum:     ["Queued", "Processing", "Completed", "Failed"],
      default:  "Queued"
    },
    error:        String,
    rerunID:      String,
    rerunStatus:  String
  }
  ],
  "created": {                type: Date, required: true, default: Date.now, index: true
},
  "completedDate":          Date,
  "user": {                   type: String, required: true
},
  "remainingTransactions": {  type: Number, required: true
},
  "totalTransactions": {      type: Number, required: true
},
  "batchSize": {              type: Number, default: 1
}
});

/*
 * The task object that describes a specific task within the OpenHIM.
 * It provides some metadata describing a task and contains a number of transaction IDs.
 */
export let Task = connectionDefault.model('Task', TaskSchema);
