mongoose = require "mongoose"
server = require "../server"
connectionDefault = server.connectionDefault
Schema = mongoose.Schema

certificate =
  country:          String
  state:            String
  locality:         String
  organization:     String
  organizationUnit: String
  commonName:       String
  emailAddress:     String
  validity:
    start:          Date
    end:            Date
  data:             String


CertificateSchema = new Schema certificate

KeystoreSchema = new Schema
  key:    String
  passphrase: String
  cert:   certificate
  ca:     [certificate]

# Model for storing the server key and cert as well as trusted certificates
exports.Keystore = connectionDefault.model 'Keystore', KeystoreSchema
exports.Certificate = connectionDefault.model 'Certificate', CertificateSchema
