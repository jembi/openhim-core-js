/* eslint-env mocha */

import should from "should";
import request from "supertest";
import * as q from "q";
import * as server from "../../src/server";
import { Transaction } from "../../src/model/transactions";
import { Task } from "../../src/model/tasks";
import { Channel } from "../../src/model/channels";
import * as tasks from "../../src/tasks";
import * as testUtils from "../testUtils";


const { ObjectId } = require("mongoose").Types;

const { auth } = testUtils;

describe("Rerun Task Tests", () => {
	const transaction1 = {
		_id: "53bfbccc6a2b417f6cd14871",
		channelID: "53bbe25485e66d8e5daad4a2",
		clientID: "42bbe25485e77d8e5daad4b4",
		request: {
			path: "/sample/api",
			headers: { authorization: "Basic dGVzdDp0ZXN0", "user-agent": "curl/7.35.0", host: "localhost:5001" },
			querystring: "param=hello",
			body: "",
			method: "GET",
			timestamp: "2014-07-15T08:10:45.109Z"
		},
		status: "Completed"
	};

	const task1 = {
		_id: "53c4dd063b8cb04d2acf0adc",
		created: "2014-07-15T07:49:26.238Z",
		remainingTransactions: 3,
		totalTransactions: 3,
		status: "Queued",
		transactions: [{ tid: "53bfbccc6a2b417f6cd14871", tstatus: "Queued" },
		{ tid: "53bfbcd06a2b417f6cd14872", tstatus: "Queued" },
		{ tid: "aaaaaaaaaabbbbbbbbbbcccc", tstatus: "Queued" }],
		user: "root@openhim.org"
	};

	const channel1 = {
		_id: "53bbe25485e66d8e5daad4a2",
		name: "TestChannel1",
		urlPattern: "test/sample",
		allow: ["PoC", "Test1", "Test2"],
		routes: [{
			name: "test route",
			host: "localhost",
			port: 9876,
			primary: true
		}
		],
		txViewAcl: "aGroup"
	};

	let authDetails = {};

	beforeEach(done =>
		Transaction.remove({}, () =>
			(new Transaction(transaction1)).save(err =>
				Task.remove({}, () =>
					(new Task(task1)).save(() =>
						Channel.remove({}, () =>
							(new Channel(channel1)).save(() => done())
						)
					)
				)
			)
		)
	);

	beforeEach((done) => testUtils.cleanupMockServers().then(done).catch(done));

	afterEach(done =>
		Transaction.remove({}, () =>
			Task.remove({}, () => done())
		)
	);

	beforeEach(() => authDetails = auth.getAuthDetails());

	describe("*rerunGetTransaction()", () => {
		it("should run rerunGetTransaction() and return Transaction object successfully", (done) => {
			const transactionID = "53bfbccc6a2b417f6cd14871";

			// run the tasks function and check results
			return tasks.rerunGetTransaction(transactionID, (err, transaction) => {
				transaction.clientID.toString().should.equal("42bbe25485e77d8e5daad4b4");
				transaction.status.should.equal("Completed");
				transaction.request.path.should.equal("/sample/api");
				transaction.request.querystring.should.equal("param=hello");
				transaction.request.method.should.equal("GET");

				return done();
			});
		});

		it("should run rerunGetTaskTransactionsData() and return transaction not found error", (done) => {
			const transactionID = "aaaaaaaaaabbbbbbbbbbcccc";

			// run the tasks function and check results
			return tasks.rerunGetTransaction(transactionID, (err, transaction) => {
				err.message.should.equal("Transaction aaaaaaaaaabbbbbbbbbbcccc could not be found");
				return done();
			});
		});
	});


	describe("*rerunSetHTTPRequestOptions()", () => {
		it("should run rerunSetHTTPRequestOptions() and return HTTP options object successfully", (done) => {
			const taskID = "53c4dd063b8cb04d2acf0adc";
			const transactionID = "53bfbccc6a2b417f6cd14871";
			return Transaction.findOne({ _id: transactionID }, (err, transaction) =>
				// run the tasks function and check results
				tasks.rerunSetHTTPRequestOptions(transaction, taskID, (err, options) => {
					options.should.have.property("hostname", "localhost");
					options.should.have.property("port", 7786);
					options.should.have.property("path", "/sample/api?param=hello");
					options.should.have.property("method", "GET");
					options.headers.should.have.property("clientID", ObjectId("42bbe25485e77d8e5daad4b4"));
					options.headers.should.have.property("parentID", ObjectId("53bfbccc6a2b417f6cd14871"));
					return done();
				})
			);
		});


		it("should run rerunSetHTTPRequestOptions() and return error if no Transaction object supplied", (done) => {
			const taskID = "53c4dd063b8cb04d2acf0adc";
			const transaction = null;
			return tasks.rerunSetHTTPRequestOptions(transaction, taskID, (err, options) => {
				err.message.should.equal("An empty Transaction object was supplied. Aborting HTTP options configuration");
				return done();
			});
		});
	});


	describe("*rerunHttpRequestSend()", () => {
		it("should run rerunHttpRequestSend() and return a successfull response", done => {
			testUtils.createMockServer(200, "Mock response for rerun Transaction #53bfbccc6a2b417f6cd14871", 7786, () => {
				const taskID = "53c4dd063b8cb04d2acf0adc";
				const transactionID = "53bfbccc6a2b417f6cd14871";
				return Transaction.findOne({ _id: transactionID }, (err, transaction) =>

					// run the tasks function and check results
					tasks.rerunSetHTTPRequestOptions(transaction, taskID, (err, options) =>

						// transaction object retrieved from fineOne
						// options generated from 'rerunSetHTTPRequestOptions' function

						tasks.rerunHttpRequestSend(options, transaction, (err, HTTPResponse) => {
							HTTPResponse.transaction.should.have.property("status", "Completed");
							HTTPResponse.should.have.property("body", "Mock response for rerun Transaction #53bfbccc6a2b417f6cd14871");
							HTTPResponse.should.have.property("status", 200);
							HTTPResponse.should.have.property("message", "OK");
							done();
						})
					)
				);
			});
		});


		it("should run rerunHttpRequestSend() and fail when \"options\" is null", (done) => {
			const transactionID = "53bfbccc6a2b417f6cd14871";
			return Transaction.findOne({ _id: transactionID }, (err, transaction) => {
				const options = null;

				return tasks.rerunHttpRequestSend(options, transaction, (err, HTTPResponse) => {
					err.message.should.equal("An empty 'Options' object was supplied. Aborting HTTP Send Request");
					return done();
				});
			});
		});


		it("should run rerunHttpRequestSend() and fail when \"transaction\" is null", (done) => {
			const options = {};
			options.hostname = "localhost";
			options.port = 7786;
			options.path = "/sample/api?param=hello";
			options.method = "GET";

			const transaction = null;
			return tasks.rerunHttpRequestSend(options, transaction, (err, HTTPResponse) => {
				err.message.should.equal("An empty 'Transaction' object was supplied. Aborting HTTP Send Request");
				return done();
			});
		});


		it("should run rerunHttpRequestSend() and return 500 Internal Server Error", done =>

			testUtils.createMockServer(200, "Mock response for rerun Transaction #53bfbccc6a2b417f6cd14871", 5252, () => {
				const transactionID = "53bfbccc6a2b417f6cd14871";
				return Transaction.findOne({ _id: transactionID }, (err, transaction) => {
					const options = {
						hostname: "localhost",
						port: 1000,
						path: "/fakepath",
						method: "GET"
					};

					return tasks.rerunHttpRequestSend(options, transaction, (err, HTTPResponse) => {
						HTTPResponse.transaction.should.have.property("status", "Failed");
						HTTPResponse.should.have.property("status", 500);
						HTTPResponse.should.have.property("message", "Internal Server Error");
						done();
					});
				});
			})
		);
	});

	describe("*rerunTcpRequestSend()", () =>
		it("should rerun the tcp request", done =>

			testUtils.createMockTCPServer(6000, "this is a test server", "TCP OK", "TCP Not OK", () => {
				const channel = {};
				channel.tcpHost = "127.0.0.1";
				channel.tcpPort = 6000;
				channel.type = "tcp";
				const transaction = {
					request: {
						body: "this is a test server"
					}
				};

				return tasks.rerunTcpRequestSend(channel, transaction, (err, data) => {
					data.body.should.be.exactly("TCP OK");
					done();
				});
			})
		)
	);

	describe("*findAndProcessAQueuedTask()", () => {
		it("should find the next available queued task and process its next round", async () => {
			await testUtils.createMockServerPromised(200, "Mock response", 7786);
			await tasks.findAndProcessAQueuedTask();

			const task = await Task.findOne({ _id: task1._id });
			task.status.should.be.equal("Queued");
			task.remainingTransactions.should.be.equal(2);
			task.transactions[0].tstatus.should.be.equal("Completed");
			task.transactions[1].tstatus.should.be.equal("Queued");
			task.transactions[2].tstatus.should.be.equal("Queued");
		});

		it("should process X transactions where X is the batch size", async () => {
			await testUtils.createMockServerPromised(200, "Mock response", 7786);
			await Task.update({ _id: task1._id }, { batchSize: 2 });
			await tasks.findAndProcessAQueuedTask();

			const task = await Task.findOne({ _id: task1._id });
			task.status.should.be.equal("Queued");
			task.remainingTransactions.should.be.equal(1);
			task.transactions[0].tstatus.should.be.equal("Completed");
			task.transactions[1].tstatus.should.be.equal("Failed"); // non-existent
			task.transactions[2].tstatus.should.be.equal("Queued");
		});

		it("should complete a queued task after all its transactions are finished", async () => {
			await testUtils.createMockServerPromised(200, "Mock response", 7786);
			await Task.update({ _id: task1._id }, { batchSize: 3 });
			await tasks.findAndProcessAQueuedTask();

			const task = await Task.findOne({ _id: task1._id });
			task.status.should.be.equal("Completed");
			task.remainingTransactions.should.be.equal(0);
			task.transactions[0].tstatus.should.be.equal("Completed");
			task.transactions[1].tstatus.should.be.equal("Failed"); // non-existent
			task.transactions[2].tstatus.should.be.equal("Failed"); // non-existent
		});

		it("should not process a paused task", done =>
			Task.update({ _id: task1._id }, { status: "Paused" }, (err) => {
				if (err) { return done(err); }

				return server = testUtils.createMockServer(200, "Mock response", 7786, () => {
					tasks.findAndProcessAQueuedTask();
					const validateTask = () =>
						Task.findOne({ _id: task1._id }, (err, task) => {
							// Task should be untouched
							task.status.should.be.equal("Paused");
							task.remainingTransactions.should.be.equal(3);
							task.transactions[0].tstatus.should.be.equal("Queued");
							task.transactions[1].tstatus.should.be.equal("Queued");
							task.transactions[2].tstatus.should.be.equal("Queued");
							return server.close(() => done());
						})
						;

					return setTimeout(validateTask, 100 * global.testTimeoutFactor);
				});
			})
		);

		it("should not process a cancelled task", done =>
			Task.update({ _id: task1._id }, { status: "Cancelled" }, (err) => {
				if (err) { return done(err); }

				return server = testUtils.createMockServer(200, "Mock response", 7786, () => {
					tasks.findAndProcessAQueuedTask();
					const validateTask = () =>
						Task.findOne({ _id: task1._id }, (err, task) => {
							// Task should be untouched
							task.status.should.be.equal("Cancelled");
							task.remainingTransactions.should.be.equal(3);
							task.transactions[0].tstatus.should.be.equal("Queued");
							task.transactions[1].tstatus.should.be.equal("Queued");
							task.transactions[2].tstatus.should.be.equal("Queued");
							return server.close(() => done());
						})
						;

					return setTimeout(validateTask, 100 * global.testTimeoutFactor);
				});
			})
		);
	});
});
