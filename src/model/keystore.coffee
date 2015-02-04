mongoose = require "mongoose"
Schema = mongoose.Schema

CertificateSchema = new Schema
  country: { type: String }
  state: { type: String }
  locality: { type: String }
  organization: { type: String }
  organizationUnit: { type: String }
  commonName: { type: String }
  emailAddress: { type: String }
  validity:
    start: { type: Date }
    end: { type: Date }

KeystoreSchema = new Schema
  key:    { type: String }
  cert:   { type: String }
  ca:     [ CertificateSchema ]

# Model for storing the server key and cert as well as trusted certificates
exports.Keystore = mongoose.model 'Keystore', KeystoreSchema
exports.Certificate = mongoose.model 'Certificate', CertificateSchema
