// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import mongoose from "mongoose";
import server from "../server";
let { connectionDefault } = server;
let { Schema } = mongoose;

let certificate = {
  country:          String,
  state:            String,
  locality:         String,
  organization:     String,
  organizationUnit: String,
  commonName:       String,
  emailAddress:     String,
  validity: {
    start:          Date,
    end:            Date
  },
  data:             String,
  fingerprint:      String
};


let CertificateSchema = new Schema(certificate);

let KeystoreSchema = new Schema({
  key:    String,
  passphrase: String,
  cert:   certificate,
  ca:     [certificate]});

// Model for storing the server key and cert as well as trusted certificates
export let Keystore = connectionDefault.model('Keystore', KeystoreSchema);
export let Certificate = connectionDefault.model('Certificate', CertificateSchema);
