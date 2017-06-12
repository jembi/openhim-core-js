/* eslint-env mocha */

import should from "should";
import request from "supertest";
import { Channel } from "../../src/model/channels";
import { Client } from "../../src/model/clients";
import { Transaction } from "../../src/model/transactions";
import { AutoRetry } from "../../src/model/autoRetry";
import { Event } from "../../src/model/events";
import * as testUtils from "../testUtils";
import * as server from "../../src/server";
import * as autoRetry from "../../src/autoRetry";
import * as tasks from "../../src/tasks";
import { config } from "../../src/config";

config.authentication = config.get("authentication");

describe("Auto Retry Integration Tests", () => {
	describe("Primary route auto retry tests", () => {
		const channel1 = new Channel({
			name: "TEST DATA - Will break channel",
			urlPattern: "^/test/nowhere$",
			allow: ["PoC"],
			routes: [{
				name: "unavailable route",
				host: "localhost",
				port: 9999,
				primary: true
			}
			],
			autoRetryEnabled: true,
			autoRetryPeriodMinutes: 1,
			autoRetryMaxAttempts: 2
		});

		const channel2 = new Channel({
			name: "TEST DATA - Will break channel - attempt once",
			urlPattern: "^/test/nowhere/2$",
			allow: ["PoC"],
			routes: [{
				name: "unavailable route",
				host: "localhost",
				port: 9999,
				primary: true
			}
			],
			autoRetryEnabled: true,
			autoRetryPeriodMinutes: 1,
			autoRetryMaxAttempts: 1
		});


		before((done) => {
			config.authentication.enableMutualTLSAuthentication = false;
			config.authentication.enableBasicAuthentication = true;

			return channel1.save(() => channel2.save(() => {
				const testAppDoc = {
					clientID: "testApp",
					clientDomain: "test-client.jembi.org",
					name: "TEST Client",
					roles:
					[
						"OpenMRS_PoC",
						"PoC"
					],
					passwordAlgorithm: "sha512",
					passwordHash: "28dce3506eca8bb3d9d5a9390135236e8746f15ca2d8c86b8d8e653da954e9e3632bf9d85484ee6e9b28a3ada30eec89add42012b185bd9a4a36a07ce08ce2ea",
					passwordSalt: "1234567890",
					cert: ""
				};

				const client = new Client(testAppDoc);
				return client.save(() => done());
			})
			);
		});

		after(done =>
			Channel.remove({ name: "TEST DATA - Will break channel" }, () =>
				Client.remove({ clientID: "testApp" }, () =>
					Transaction.remove({}, () => AutoRetry.remove({}, () => done())
					)
				)
			)
		);

		beforeEach(done => Transaction.remove({}, () => AutoRetry.remove({}, () => Event.remove({}, done))));

		afterEach(done => server.stop(() => done()));


		it("should mark transaction as available to auto retry if an internal server error occurs", done =>
			server.start({ httpPort: 5001 }, () =>
				request("http://localhost:5001")
					.get("/test/nowhere")
					.auth("testApp", "password")
					.expect(500)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							return setTimeout((() =>
								Transaction.findOne({}, (err, trx) => {
									if (err) { return done(err); }
									trx.should.have.property("autoRetry");
									trx.autoRetry.should.be.true();
									trx.should.have.property("error");
									trx.error.should.have.property("message");
									trx.error.should.have.property("stack");
									(trx.error.message.indexOf("ECONNREFUSED") > -1).should.be.true();
									return done();
								})
							), 150 * global.testTimeoutFactor);
						}
					})
			)
		);

		it("should push an auto retry transaction to the auto retry queue", done =>
			server.start({ httpPort: 5001, rerunHttpPort: 7786 }, () =>
				request("http://localhost:5001")
					.get("/test/nowhere")
					.auth("testApp", "password")
					.expect(500)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							return setTimeout((() =>
								Transaction.findOne({}, (err, trx) => {
									if (err) { return done(err); }
									return AutoRetry.findOne({}, (err, autoRetry) => {
										if (err) { return done(err); }
										autoRetry.transactionID.toString().should.be.equal(trx._id.toString());
										autoRetry.channelID.toString().should.be.equal(channel1._id.toString());
										return done();
									});
								})
							), 150 * global.testTimeoutFactor);
						}
					})
			)
		);

		it("should auto retry a failed transaction", done =>
			server.start({ httpPort: 5001, rerunHttpPort: 7786 }, () =>
				request("http://localhost:5001")
					.get("/test/nowhere")
					.auth("testApp", "password")
					.expect(500)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							return setTimeout((() =>
								// manually trigger rerun
								autoRetry.autoRetryTask(null, () => {
									tasks.findAndProcessAQueuedTask();

									return setTimeout((() =>
										Transaction.find({}, (err, transactions) => {
											if (err) { return done(err); }
											transactions.length.should.be.exactly(2);
											transactions[0].childIDs[0].toString().should.be.equal(transactions[1]._id.toString());
											transactions[1].autoRetryAttempt.should.be.exactly(1);
											// failed so should be eligible to rerun again
											transactions[1].autoRetry.should.be.true();
											return done();
										})
									), 150 * global.testTimeoutFactor);
								})
							), 150 * global.testTimeoutFactor);
						}
					})
			)
		);

		it("should not auto retry a transaction that has reached the max retry limit", done =>
			server.start({ httpPort: 5001, rerunHttpPort: 7786 }, () =>
				request("http://localhost:5001")
					.get("/test/nowhere/2")
					.auth("testApp", "password")
					.expect(500)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							return setTimeout((() =>
								// manually trigger rerun
								autoRetry.autoRetryTask(null, () => {
									tasks.findAndProcessAQueuedTask();

									return setTimeout((() =>
										Transaction.find({}, (err, transactions) => {
											if (err) { return done(err); }
											transactions.length.should.be.exactly(2);
											transactions[0].childIDs[0].toString().should.be.equal(transactions[1]._id.toString());
											transactions[1].autoRetryAttempt.should.be.exactly(1);
											// should not be eligible to retry
											transactions[1].autoRetry.should.be.false();
											return done();
										})
									), 150 * global.testTimeoutFactor);
								})
							), 150 * global.testTimeoutFactor);
						}
					})
			)
		);

		it("should contain the attempt number in transaction events", done =>
			server.start({ httpPort: 5001, rerunHttpPort: 7786 }, () =>
				request("http://localhost:5001")
					.get("/test/nowhere")
					.auth("testApp", "password")
					.expect(500)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							return setTimeout((() =>
								// manually trigger rerun
								autoRetry.autoRetryTask(null, () => {
									tasks.findAndProcessAQueuedTask();

									return setTimeout((() =>
										Event.find({}, (err, events) => {
											if (err) { return done(err); }
											const prouteEvents = events.filter(ev => (ev.type === "primary") && (ev.event === "end"));

											// original transaction
											should(prouteEvents[0].autoRetryAttempt).be.null();
											// retried transaction
											prouteEvents[1].autoRetryAttempt.should.be.exactly(1);
											return done();
										})
									), 150 * global.testTimeoutFactor);
								})
							), 150 * global.testTimeoutFactor);
						}
					})
			)
		);
	});

	describe("Secondary route auto retry tests", () => {
		let mockServer1 = null;

		const channel1 = new Channel({
			name: "TEST DATA - Secondary route will break channel",
			urlPattern: "^/test/nowhere$",
			allow: ["PoC"],
			routes: [{
				name: "available route",
				host: "localhost",
				port: 1233,
				primary: true
			},
			{
				name: "unavailable route",
				host: "localhost",
				port: 9999
			}
			]
		});

		before((done) => {
			config.authentication.enableMutualTLSAuthentication = false;
			config.authentication.enableBasicAuthentication = true;

			return channel1.save((err) => {
				const testAppDoc = {
					clientID: "testApp",
					clientDomain: "test-client.jembi.org",
					name: "TEST Client",
					roles:
					[
						"OpenMRS_PoC",
						"PoC"
					],
					passwordAlgorithm: "sha512",
					passwordHash: "28dce3506eca8bb3d9d5a9390135236e8746f15ca2d8c86b8d8e653da954e9e3632bf9d85484ee6e9b28a3ada30eec89add42012b185bd9a4a36a07ce08ce2ea",
					passwordSalt: "1234567890",
					cert: ""
				};

				const client = new Client(testAppDoc);
				return client.save(() => mockServer1 = testUtils.createMockServer(200, "target1", 1233, () => done()));
			});
		});

		after(done =>
			Channel.remove({ name: "TEST DATA - Secondary route will break channel" }, () =>
				Client.remove({ clientID: "testApp" }, () =>
					Transaction.remove({}, () =>
						mockServer1.close(() => done())
					)
				)
			)
		);

		beforeEach(done => Transaction.remove({}, done));

		afterEach(done =>
			server.stop(() => done())
		);


		it("should mark transaction as available to auto retry if an internal server error occurs on a secondary route", done =>
			server.start({ httpPort: 5001 }, () =>
				request("http://localhost:5001")
					.get("/test/nowhere")
					.auth("testApp", "password")
					.expect(200)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							return setTimeout((() =>
								Transaction.findOne({}, (err, trx) => {
									if (err) { return done(err); }
									trx.should.have.property("autoRetry");
									trx.autoRetry.should.be.true();
									trx.routes[0].should.have.property("error");
									trx.routes[0].error.should.have.property("message");
									trx.routes[0].error.should.have.property("stack");
									(trx.routes[0].error.message.indexOf("ECONNREFUSED") > -1).should.be.true();
									return done();
								})
							), 150 * global.testTimeoutFactor);
						}
					})
			)
		);
	});

	describe("Mediator auto retry tests", () => {
		let mockServer1 = null;

		const channel1 = new Channel({
			name: "TEST DATA - Mediator has error channel",
			urlPattern: "^/test/nowhere$",
			allow: ["PoC"],
			routes: [{
				name: "mediator route",
				host: "localhost",
				port: 1233,
				primary: true
			}
			]
		});

		const mediatorResponse = {
			"x-mediator-urn": "urn:mediator:test",
			status: "Failed",
			response: {
				status: 500,
				body: "Internal server error",
				timestamp: new Date()
			},
			error: {
				message: "Connection refused",
				stack: "thething@line23"
			}
		};

		before((done) => {
			config.authentication.enableMutualTLSAuthentication = false;
			config.authentication.enableBasicAuthentication = true;

			return channel1.save((err) => {
				const testAppDoc = {
					clientID: "testApp",
					clientDomain: "test-client.jembi.org",
					name: "TEST Client",
					roles:
					[
						"OpenMRS_PoC",
						"PoC"
					],
					passwordAlgorithm: "sha512",
					passwordHash: "28dce3506eca8bb3d9d5a9390135236e8746f15ca2d8c86b8d8e653da954e9e3632bf9d85484ee6e9b28a3ada30eec89add42012b185bd9a4a36a07ce08ce2ea",
					passwordSalt: "1234567890",
					cert: ""
				};

				const client = new Client(testAppDoc);
				return client.save(() => mockServer1 = testUtils.createMockMediatorServer(200, mediatorResponse, 1233, () => done()));
			});
		});

		after(done =>
			Channel.remove({ name: "TEST DATA - Mediator has error channel" }, () =>
				Client.remove({ clientID: "testApp" }, () =>
					Transaction.remove({}, () =>
						mockServer1.close(() => done())
					)
				)
			)
		);

		beforeEach(done => Transaction.remove({}, done));

		afterEach(done =>
			server.stop(() => done())
		);


		it("should mark transaction as available to auto retry if an internal server error occurs in a mediator", done =>
			server.start({ httpPort: 5001 }, () =>
				request("http://localhost:5001")
					.get("/test/nowhere")
					.auth("testApp", "password")
					.expect(500)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							return setTimeout((() =>
								Transaction.findOne({}, (err, trx) => {
									if (err) { return done(err); }
									trx.should.have.property("autoRetry");
									trx.autoRetry.should.be.true();
									trx.should.have.property("error");
									trx.error.should.have.property("message");
									trx.error.message.should.be.exactly(mediatorResponse.error.message);
									trx.error.should.have.property("stack");
									trx.error.stack.should.be.exactly(mediatorResponse.error.stack);
									return done();
								})
							), 150 * global.testTimeoutFactor);
						}
					})
			)
		);
	});

	return describe("All routes failed auto retry tests", () => {
		const channel1 = new Channel({
			name: "TEST DATA - Both will break channel",
			urlPattern: "^/test/nowhere$",
			allow: ["PoC"],
			routes: [{
				name: "unavailable route 1",
				host: "localhost",
				port: 9999,
				primary: true
			},
			{
				name: "unavailable route 2",
				host: "localhost",
				port: 9988
			}
			]
		});

		before((done) => {
			config.authentication.enableMutualTLSAuthentication = false;
			config.authentication.enableBasicAuthentication = true;

			return channel1.save((err) => {
				const testAppDoc = {
					clientID: "testApp",
					clientDomain: "test-client.jembi.org",
					name: "TEST Client",
					roles:
					[
						"OpenMRS_PoC",
						"PoC"
					],
					passwordAlgorithm: "sha512",
					passwordHash: "28dce3506eca8bb3d9d5a9390135236e8746f15ca2d8c86b8d8e653da954e9e3632bf9d85484ee6e9b28a3ada30eec89add42012b185bd9a4a36a07ce08ce2ea",
					passwordSalt: "1234567890",
					cert: ""
				};

				const client = new Client(testAppDoc);
				return client.save(() => done());
			});
		});

		after(done =>
			Channel.remove({ name: "TEST DATA - Both will break channel" }, () =>
				Client.remove({ clientID: "testApp" }, () =>
					Transaction.remove({}, () => done())
				)
			)
		);

		beforeEach(done => Transaction.remove({}, done));

		afterEach(done =>
			server.stop(() => done())
		);


		it("should mark transaction as available to auto retry if an internal server error occurs on both primary and secondary routes", done =>
			server.start({ httpPort: 5001 }, () =>
				request("http://localhost:5001")
					.get("/test/nowhere")
					.auth("testApp", "password")
					.expect(500)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							return setTimeout((() =>
								Transaction.findOne({}, (err, trx) => {
									if (err) { return done(err); }
									trx.should.have.property("autoRetry");
									trx.autoRetry.should.be.true();
									trx.should.have.property("error");
									trx.error.should.have.property("message");
									trx.error.should.have.property("stack");
									(trx.error.message.indexOf("ECONNREFUSED") > -1).should.be.true();
									trx.routes[0].should.have.property("error");
									trx.routes[0].error.should.have.property("message");
									trx.routes[0].error.should.have.property("stack");
									(trx.routes[0].error.message.indexOf("ECONNREFUSED") > -1).should.be.true();
									return done();
								})
							), 150 * global.testTimeoutFactor);
						}
					})
			)
		);
	});
});
