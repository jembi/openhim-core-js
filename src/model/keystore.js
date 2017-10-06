import { Schema } from 'mongoose'
import { connectionAPI, connectionDefault } from '../config'

const certificate = {
  country: String,
  state: String,
  locality: String,
  organization: String,
  organizationUnit: String,
  commonName: String,
  emailAddress: String,
  validity: {
    start: Date,
    end: Date
  },
  data: String,
  fingerprint: String
}

const CertificateSchema = new Schema(certificate)

const KeystoreSchema = new Schema({
  key: String,
  passphrase: String,
  cert: certificate,
  ca: [certificate]
})

// Model for storing the server key and cert as well as trusted certificates
export const KeystoreModelAPI = connectionAPI.model('Keystore', KeystoreSchema)
export const CertificateModelAPI = connectionAPI.model('Certificate', CertificateSchema)
export const KeystoreModel = connectionDefault.model('Keystore', KeystoreSchema)
export const CertificateModel = connectionDefault.model('Certificate', CertificateSchema)
