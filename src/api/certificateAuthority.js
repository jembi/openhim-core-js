import Q from "q";
import logger from "winston";
import pem from "pem";
import { Keystore, Certificate } from "../model/keystore";
import utils from "../utils";
import authorisation from "./authorisation";

const readCertificateInfo = Q.denodeify(pem.readCertificateInfo);
const getFingerprint = Q.denodeify(pem.getFingerprint);

export function* generateCert() {
	// Must be admin
	let result;
	if (authorisation.inGroup("admin", this.authenticated) === false) {
		utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to getServerKey by id denied.`, "info");
		return;
	}

	const options = this.request.body;
	if (options.type === "server") {
		logger.info("Generating server cert");
		result = yield generateServerCert(options);
	} else {
		logger.info("Generating client cert");
		result = yield generateClientCert(options);
	}
	this.status = 201;
	this.body = result;
	return this.body;
}

function* generateClientCert(options) {
	const keystoreDoc = yield Keystore.findOne().exec();

	// Set additional options
	options.selfSigned = true;

	// Attempt to create the certificate
	try {
		this.body = yield createCertificate(options);
		const certInfo = yield extractCertMetadata(this.body.certificate);
		keystoreDoc.ca.push(certInfo);
		yield Q.ninvoke(keystoreDoc, "save");
		// Add the new certficate to the keystore
		this.status = 201;
		logger.info("Client certificate created");
	} catch (err) {
		utils.logAndSetResponse(this, "internal server error", `Could not create a client cert via the API: ${err}`, "error");
	}
	return this.body;
}

function* generateServerCert(options) {
	const keystoreDoc = yield Keystore.findOne().exec();
	options.selfSigned = true;
	try {
		this.body = yield createCertificate(options);
		keystoreDoc.cert = yield extractCertMetadata(this.body.certificate);
		keystoreDoc.key = this.body.key;
		yield Q.ninvoke(keystoreDoc, "save");
		// Add the new certficate to the keystore
		this.status = 201;
		logger.info("Server certificate created");
	} catch (err) {
		utils.logAndSetResponse(this, "internal server error", `Could not create a client cert via the API: ${err}`, "error");
	}
	return this.body;
}

function createCertificate(options) {
	const deferred = Q.defer();
	pem.createCertificate(options, (err, cert) => {
		let response;
		if (err) {
			response =
				{ err };
			return deferred.resolve(response);
		} else {
			response = {
				certificate: cert.certificate,
				key: cert.clientKey
			};
			return deferred.resolve(response);
		}
	});

	return deferred.promise;
}

function* extractCertMetadata(cert) {
	const certInfo = yield readCertificateInfo(cert);
	const fingerprint = yield getFingerprint(cert);
	certInfo.data = this.body.certificate;
	certInfo.fingerprint = fingerprint.fingerprint;
	return certInfo;
}

const getRandomInt = (min, max) => Math.floor(Math.random() * ((max - min) + 1)) + min;
