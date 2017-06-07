/* eslint-env mocha */

import should from "should";
import request from "supertest";
import sinon from "sinon";
import fs from "fs";
import path from "path";
import testUtils from "../testUtils";
import server from "../../src/server";
import { Keystore } from "../../src/model/keystore";
import config from "../../src/config/config";

const { auth } = testUtils;
config.certificateManagement = config.get("certificateManagement");

describe("API Integration Tests", () =>

	describe("Keystore API Tests", () => {
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

		it("Should fetch the current HIM server certificate", done =>
			testUtils.setupTestKeystore(keystore =>
				request("https://localhost:8080")
					.get("/keystore/cert")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(200)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							res.body.data.should.be.exactly(keystore.cert.data);
							res.body.commonName.should.be.exactly("localhost");
							return done();
						}
					})
			)
		);

		it("Should not allow a non-admin user to fetch the current HIM server certificate", done =>
			testUtils.setupTestKeystore(() =>
				request("https://localhost:8080")
					.get("/keystore/cert")
					.set("auth-username", testUtils.nonRootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(403)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							return done();
						}
					})
			)
		);

		it("Should fetch the current trusted ca certificates", done =>
			testUtils.setupTestKeystore(keystore =>
				request("https://localhost:8080")
					.get("/keystore/ca")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(200)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							res.body.should.be.instanceof(Array).and.have.lengthOf(2);
							res.body[0].should.have.property("commonName", keystore.ca[0].commonName);
							res.body[1].should.have.property("commonName", keystore.ca[1].commonName);
							return done();
						}
					})
			)
		);

		it("Should not allow a non-admin user to fetch the current trusted ca certificates", done =>
			testUtils.setupTestKeystore(() =>
				request("https://localhost:8080")
					.get("/keystore/ca")
					.set("auth-username", testUtils.nonRootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(403)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							return done();
						}
					})
			)
		);

		it("Should fetch a ca certificate by id", done =>
			testUtils.setupTestKeystore(keystore =>
				request("https://localhost:8080")
					.get(`/keystore/ca/${keystore.ca[0]._id}`)
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(200)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							res.body.should.have.property("commonName", keystore.ca[0].commonName);
							res.body.should.have.property("data", keystore.ca[0].data);
							return done();
						}
					})
			)
		);

		it("Should not allow a non-admin user to fetch a ca certificate by id", done =>
			testUtils.setupTestKeystore(() =>
				request("https://localhost:8080")
					.get("/keystore/ca/1234")
					.set("auth-username", testUtils.nonRootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(403)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							return done();
						}
					})
			)
		);

		it("Should add a new server certificate", done =>
			testUtils.setupTestKeystore((keystore) => {
				const postData = { cert: fs.readFileSync("test/resources/server-tls/cert.pem").toString() };
				return request("https://localhost:8080")
					.post("/keystore/cert")
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
								if (err) { done(err); }
								keystore.cert.data.should.be.exactly(postData.cert);
								keystore.cert.commonName.should.be.exactly("localhost");
								keystore.cert.organization.should.be.exactly("Jembi Health Systems NPC");
								return done();
							});
						}
					});
			})
		);

		it("Should calculate and store the correct certificate fingerprint", done =>
			testUtils.setupTestKeystore((keystore) => {
				const postData = { cert: fs.readFileSync("test/resources/server-tls/cert.pem").toString() };
				return request("https://localhost:8080")
					.post("/keystore/cert")
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
								if (err) { done(err); }
								keystore.cert.fingerprint.should.be.exactly("35:B1:95:80:45:F6:39:A8:1E:75:E1:B1:16:16:32:EB:12:EA:1A:24");
								return done();
							});
						}
					});
			})
		);

		it("Should return a 400 if the server certificate isn't valid", done =>
			testUtils.setupTestKeystore((keystore) => {
				const postData = { cert: "junkjunkjunk" };
				return request("https://localhost:8080")
					.post("/keystore/cert")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.send(postData)
					.expect(400)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							return done();
						}
					});
			})
		);

		it("Should not allow a non-admin user to add a new server certificate", done =>
			testUtils.setupTestKeystore((keystore) => {
				const postData = { cert: fs.readFileSync("test/resources/server-tls/cert.pem").toString() };
				return request("https://localhost:8080")
					.post("/keystore/cert")
					.set("auth-username", testUtils.nonRootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.send(postData)
					.expect(403)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							return done();
						}
					});
			})
		);

		it("Should return 400 if watchFSForCert option is true when adding a cert.", done =>
			testUtils.setupTestKeystore((keystore) => {
				config.certificateManagement.watchFSForCert = true;
				const postData = { cert: fs.readFileSync("test/resources/server-tls/cert.pem").toString() };
				return request("https://localhost:8080")
					.post("/keystore/cert")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.send(postData)
					.expect(400)
					.end((err, res) => {
						if (err) {
							config.certificateManagement.watchFSForCert = false;
							return done(err);
						} else {
							config.certificateManagement.watchFSForCert = false;
							return done();
						}
					});
			})
		);

		it("Should add a new server key", done =>
			testUtils.setupTestKeystore((keystore) => {
				const postData = { key: fs.readFileSync("test/resources/server-tls/key.pem").toString() };
				return request("https://localhost:8080")
					.post("/keystore/key")
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
								if (err) { done(err); }
								keystore.key.should.be.exactly(postData.key);
								return done();
							});
						}
					});
			})
		);

		it("Should not allow a non-admin user to add a new server key", done =>
			testUtils.setupTestKeystore((keystore) => {
				const postData = { key: fs.readFileSync("test/resources/server-tls/key.pem").toString() };
				return request("https://localhost:8080")
					.post("/keystore/key")
					.set("auth-username", testUtils.nonRootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.send(postData)
					.expect(403)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							return done();
						}
					});
			})
		);

		it("Should add a new trusted certificate", done =>
			testUtils.setupTestKeystore((keystore) => {
				const postData = { cert: fs.readFileSync("test/resources/trust-tls/cert1.pem").toString() };
				return request("https://localhost:8080")
					.post("/keystore/ca/cert")
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
								if (err) { done(err); }
								keystore.ca.should.be.instanceOf(Array).and.have.lengthOf(3);
								keystore.ca[2].data.should.be.exactly(postData.cert);
								keystore.ca[2].commonName.should.be.exactly("trust1.org");
								keystore.ca[2].organization.should.be.exactly("Trusted Inc.");
								return done();
							});
						}
					});
			})
		);

		it("Should calculate fingerprint for new trusted certificate", done =>
			testUtils.setupTestKeystore((keystore) => {
				const postData = { cert: fs.readFileSync("test/resources/trust-tls/cert1.pem").toString() };
				return request("https://localhost:8080")
					.post("/keystore/ca/cert")
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
								if (err) { done(err); }
								keystore.ca[2].fingerprint.should.be.exactly("23:1D:0B:AA:70:06:A5:D4:DC:E9:B9:C3:BD:2C:56:7F:29:D2:3E:54");
								return done();
							});
						}
					});
			})
		);

		it("Should respond with a 400 if one or more certs are invalid", done =>
			testUtils.setupTestKeystore((keystore) => {
				const postData = { cert: "junkjunkjunk" };
				return request("https://localhost:8080")
					.post("/keystore/ca/cert")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.send(postData)
					.expect(400)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							return done();
						}
					});
			})
		);

		it("Should not allow a non-admin user to add a new trusted certificate", done =>
			testUtils.setupTestKeystore((keystore) => {
				const postData = { cert: fs.readFileSync("test/resources/trust-tls/cert1.pem").toString() };
				return request("https://localhost:8080")
					.post("/keystore/ca/cert")
					.set("auth-username", testUtils.nonRootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.send(postData)
					.expect(403)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							return done();
						}
					});
			})
		);

		it("Should add each certificate in a certificate chain", done =>
			testUtils.setupTestKeystore((keystore) => {
				const postData = { cert: fs.readFileSync("test/resources/chain.pem").toString() };
				return request("https://localhost:8080")
					.post("/keystore/ca/cert")
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
								if (err) { done(err); }
								keystore.ca.should.be.instanceOf(Array).and.have.lengthOf(4);
								keystore.ca[2].commonName.should.be.exactly("domain.com");
								keystore.ca[3].commonName.should.be.exactly("ca.marc-hi.ca");
								return done();
							});
						}
					});
			})
		);

		it("Should return 400 with there is an invlaid cert in the chain", done =>
			testUtils.setupTestKeystore((keystore) => {
				const postData = { cert: fs.readFileSync("test/resources/invalid-chain.pem").toString() };
				return request("https://localhost:8080")
					.post("/keystore/ca/cert")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.send(postData)
					.expect(400)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							return done();
						}
					});
			})
		);

		it("Should remove a ca certificate by id", done =>
			testUtils.setupTestKeystore(keystore =>
				request("https://localhost:8080")
					.del(`/keystore/ca/${keystore.ca[0]._id}`)
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(200)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							return Keystore.findOne({}, (err, keystore) => {
								if (err) { done(err); }
								keystore.ca.should.be.instanceOf(Array).and.have.lengthOf(1);
								return done();
							});
						}
					})
			)
		);

		it("Should not allow a non-admin user to remove a ca certificate by id", done =>
			testUtils.setupTestKeystore(() =>
				request("https://localhost:8080")
					.del("/keystore/ca/1234")
					.set("auth-username", testUtils.nonRootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(403)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							return done();
						}
					})
			)
		);

		it("Should verify that a valid server cert and key match", done =>
			testUtils.setupTestKeystore(keystore =>
				request("https://localhost:8080")
					.get("/keystore/validity")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(200)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							res.body.valid.should.be.exactly(true);
							return done();
						}
					})
			)
		);

		it("Should verify that an server cert and key DO NOT match if they are invalid", done =>
			testUtils.setupTestKeystore((keystore) => {
				keystore.key = fs.readFileSync("test/resources/trust-tls/key1.pem");
				return keystore.save(() =>
					request("https://localhost:8080")
						.get("/keystore/validity")
						.set("auth-username", testUtils.rootUser.email)
						.set("auth-ts", authDetails.authTS)
						.set("auth-salt", authDetails.authSalt)
						.set("auth-token", authDetails.authToken)
						.expect(200)
						.end((err, res) => {
							if (err) {
								return done(err);
							} else {
								res.body.valid.should.be.exactly(false);
								return done();
							}
						})
				);
			})
		);

		it("Should respond with a 400 if one or more certs are invalid when checking validity", done =>
			testUtils.setupTestKeystore((keystore) => {
				keystore.key = "junkjunkjunk";
				return keystore.save(() =>
					request("https://localhost:8080")
						.get("/keystore/validity")
						.set("auth-username", testUtils.rootUser.email)
						.set("auth-ts", authDetails.authTS)
						.set("auth-salt", authDetails.authSalt)
						.set("auth-token", authDetails.authToken)
						.expect(400)
						.end((err, res) => {
							if (err) {
								return done(err);
							} else {
								return done();
							}
						})
				);
			})
		);

		it("Should find the compare the modulus of a certificate with its corresponding protected key", done =>
			testUtils.setupTestKeystore((keystore) => {
				keystore.key = fs.readFileSync("test/resources/protected/test.key");
				keystore.cert.data = fs.readFileSync("test/resources/protected/test.crt");
				keystore.passphrase = "password";
				return keystore.save(() =>
					request("https://localhost:8080")
						.get("/keystore/validity")
						.set("auth-username", testUtils.rootUser.email)
						.set("auth-ts", authDetails.authTS)
						.set("auth-salt", authDetails.authSalt)
						.set("auth-token", authDetails.authToken)
						.expect(200)
						.end((err, res) => {
							if (err) {
								return done(err);
							} else {
								res.body.valid.should.be.exactly(true);
								return done();
							}
						})
				);
			})
		);

		return it("Should return false for when validating a protected key without a passphrase", done =>
			testUtils.setupTestKeystore((keystore) => {
				keystore.key = fs.readFileSync("test/resources/protected/test.key");
				keystore.cert.data = fs.readFileSync("test/resources/protected/test.crt");
				keystore.passphrase = undefined;
				return keystore.save(() =>
					request("https://localhost:8080")
						.get("/keystore/validity")
						.set("auth-username", testUtils.rootUser.email)
						.set("auth-ts", authDetails.authTS)
						.set("auth-salt", authDetails.authSalt)
						.set("auth-token", authDetails.authToken)
						.expect(200)
						.end((err, res) => {
							if (err) {
								return done(err);
							} else {
								res.body.valid.should.be.exactly(false);
								return done();
							}
						})
				);
			})
		);
	})
);
