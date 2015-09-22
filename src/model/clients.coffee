mongoose = require "mongoose"
server = require "../server"
connectionDefault = server.connectionDefault
Schema = mongoose.Schema

ClientSchema = new Schema
  "clientID":           type: String, required: true, unique: true, index: true
  "clientDomain":       type: String, unqiue: true, index: true
  "name":               type: String, required: true
  "roles":              [type: String, required: true]
  "passwordAlgorithm":  String
  "passwordHash":       String
  "passwordSalt":       String
  "certFingerprint":    String
  "organization":       String
  "location":           String
  "softwareName":       String
  "description":        String
  "contactPerson":      String
  "contactPersonEmail": String
 
#compile the Client Schema into a Model
exports.Client = connectionDefault.model 'Client', ClientSchema
