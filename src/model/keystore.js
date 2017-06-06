import mongoose from "mongoose";
import server from "../server";

const { connectionDefault } = server;
const { Schema } = mongoose;

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
};


const CertificateSchema = new Schema(certificate);

const KeystoreSchema = new Schema({
	key: String,
	passphrase: String,
	cert: certificate,
	ca: [certificate]
});

// Model for storing the server key and cert as well as trusted certificates
export const Keystore = connectionDefault.model("Keystore", KeystoreSchema);
export const Certificate = connectionDefault.model("Certificate", CertificateSchema);
