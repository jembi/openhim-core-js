/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import should from "should";
import request from "supertest";
import sinon from "sinon";
import fs from "fs";
import path from "path";
import * as testUtils from "../testUtils";
import * as server from "../../src/server";
import { Keystore, Certificate } from "../../src/model/keystore";

const { auth } = testUtils;

describe("API Integration Tests", () =>
	describe("Certificate API Tests", () => {
		let authDetails = {};
		before(done =>
			auth.setupTestUsers(err =>
				server.start({ apiPort: 8080 }, () => done())
			)
		);

		after(done =>
			auth.cleanupTestUsers(err =>
				server.stop(() => done())
			)
		);

		beforeEach((done) => {
			authDetails = auth.getAuthDetails();
			return done();
		});

		afterEach(done =>
			testUtils.cleanupTestKeystore(() => done())
		);

		it("Should create a new client certificate", done =>
			testUtils.setupTestKeystore((keystore) => {
				const postData = {
					type: "client",
					commonName: "testcert.com",
					country: "za",
					days: 365,
					emailAddress: "test@testcert.com",
					state: "test state",
					locality: "test locality",
					organization: "test Org",
					organizationUnit: "testOrg unit"
				};

				return request("https://localhost:8080")
					.post("/certificates")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.send(postData)
					.expect(201)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							return Keystore.findOne({}, (err, keystore) => {
								const result = JSON.parse(res.text);
								result.certificate.should.not.be.empty;
								result.key.should.not.be.empty;
								if (err) { done(err); }
								keystore.ca.should.be.instanceOf(Array).and.have.lengthOf(3);
								keystore.ca[2].commonName.should.be.exactly("testcert.com");
								keystore.ca[2].organization.should.be.exactly("test Org");
								keystore.ca[2].country.should.be.exactly("za");
								keystore.ca[2].fingerprint.should.exist;
								return done();
							});
						}
					});
			})
		);

		return it("Should create a new server certificate", done =>
			testUtils.setupTestKeystore((keystore) => {
				const serverCert = fs.readFileSync("test/resources/server-tls/cert.pem");
				const serverKey = fs.readFileSync("test/resources/server-tls/key.pem");

				const postData = {
					type: "server",
					commonName: "testcert.com",
					country: "za",
					days: 365,
					emailAddress: "test@testcert.com",
					state: "test state",
					locality: "test locality",
					organization: "test Org",
					organizationUnit: "testOrg unit"
				};

				return request("https://localhost:8080")
					.post("/certificates")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.send(postData)
					.expect(201)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							return Keystore.findOne({}, (err, keystore) => {
								const result = JSON.parse(res.text);
								result.certificate.should.not.be.empty;
								result.key.should.not.be.empty;
								if (err) { done(err); }

								keystore.cert.commonName.should.be.exactly("testcert.com");
								keystore.cert.organization.should.be.exactly("test Org");
								keystore.cert.country.should.be.exactly("za");
								keystore.cert.fingerprint.should.exist;
								keystore.cert.data.should.not.equal(serverCert.toString());
								keystore.key.should.not.equal(serverKey.toString());
								return done();
							});
						}
					});
			})
		);
	})
);
