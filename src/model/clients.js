import mongoose from "mongoose";
import server from "../server";
let { connectionDefault } = server;
let { Schema } = mongoose;

let ClientSchema = new Schema({
  "clientID": {           type: String, required: true, unique: true, index: true
},
  "clientDomain": {       type: String, unqiue: true, index: true
},
  "name": {               type: String, required: true
},
  "roles":              [{type: String, required: true}],
  "passwordAlgorithm":  String,
  "passwordHash":       String,
  "passwordSalt":       String,
  "certFingerprint":    String,
  "organization":       String,
  "location":           String,
  "softwareName":       String,
  "description":        String,
  "contactPerson":      String,
  "contactPersonEmail": String
});
 
//compile the Client Schema into a Model
export let Client = connectionDefault.model('Client', ClientSchema);
