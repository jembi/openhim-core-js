mongoose = require "mongoose"
server = require "../server"
connectionDefault = server.connectionDefault
Schema = mongoose.Schema

ClientSchema = new Schema
  "clientID":           type: String, required: true, unique: true, index: true
  "clientDomain":       type: String, required: true, unqiue: true, index: true
  "name":               type: String, required: true
  "roles":              [type: String, required: true]
  "passwordAlgorithm":  String
  "passwordHash":       String
  "passwordSalt":       String
    
#compile the Client Schema into a Model
exports.Client = connectionDefault.model 'Client', ClientSchema
