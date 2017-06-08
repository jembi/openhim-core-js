/* eslint-env mocha */

import should from "should";
import request from "supertest";
import { Transaction } from "../../src/model/transactions";
import { Channel } from "../../src/model/channels";
import * as testUtils from "../testUtils";
import { config } from "../../src/config";
import * as server from "../../src/server";

const { auth } = testUtils;

describe("API Metrics Tests", () =>

	describe("OpenHIM Metrics Api testing", () => {
		const channel1 = new Channel({
			_id: "111111111111111111111111",
			name: "Test Channel 11111",
			urlPattern: "test/sample",
			allow: ["PoC", "Test1", "Test2"],
			routes: [{ name: "test route", host: "localhost", port: 9876 }]
		});

		const channel2 = new Channel({
			_id: "222222222222222222222222",
			name: "Test Channel 22222",
			urlPattern: "test/sample",
			allow: ["PoC", "Test1", "Test2"],
			routes: [{ name: "test route", host: "localhost", port: 9876 }],
			txViewAcl: ["group1"]
		});

		let authDetails = {};

		before((done) => {
			config.statsd.enabled = false;
			return Channel.remove({}, () =>
				Transaction.remove({}, () =>
					channel1.save(err =>
						channel2.save(err =>
							testUtils.setupMetricsTransactions(() =>
								auth.setupTestUsers((err) => {
									if (err) { return done(err); }
									config.statsd.enabled = false;
									return server.start({ apiPort: 8080, tcpHttpReceiverPort: 7787 }, () => done());
								})
							)
						)
					)
				)
			);
		});

		after(done =>
			server.stop(() =>
				auth.cleanupTestUsers(() =>
					Channel.remove({}, () =>
						Transaction.remove({}, () => done())
					)
				)
			)
		);

		beforeEach(() => authDetails = auth.getAuthDetails());

		return describe("*getMetrics()", () => {
			it("should fetch metrics and return a 200", done =>
				request("https://localhost:8080")
					.get("/metrics?startDate=2014-07-15T00:00:00.000Z&endDate=2014-07-19T00:00:00.000Z")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(200)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							res.body.length.should.be.exactly(1);
							res.body[0].total.should.be.exactly(10);
							return done();
						}
					})
			);

			it("should fetch metrics broken down by channels and return a 200", done =>
				request("https://localhost:8080")
					.get("/metrics/channels?startDate=2014-07-15T00:00:00.000Z&endDate=2014-07-19T00:00:00.000Z")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(200)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							res.body.length.should.be.exactly(2);
							res.body[0].total.should.be.exactly(5);
							res.body[1].total.should.be.exactly(5);
							return done();
						}
					})
			);

			it("should fetch metrics for a particular channel and return a 200", done =>
				request("https://localhost:8080")
					.get("/metrics/channels/222222222222222222222222?startDate=2014-07-15T00:00:00.000Z&endDate=2014-07-19T00:00:00.000Z")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(200)
					.end((err, res) => {
						if (err) {
							console.log(err.stack);
							return done(err);
						} else {
							res.body.length.should.be.exactly(1);
							res.body[0]._id.channelID.should.be.exactly("222222222222222222222222");
							return done();
						}
					})
			);

			it("should fetch metrics in timeseries and return a 200", done =>
				request("https://localhost:8080")
					.get("/metrics/timeseries/day?startDate=2014-07-15T00:00:00.000Z&endDate=2014-07-19T00:00:00.000Z")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(200)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							res.body.length.should.be.exactly(4);
							should.exist(res.body[0]._id.day);
							should.exist(res.body[0]._id.month);
							should.exist(res.body[0]._id.year);
							return done();
						}
					})
			);

			it("should fetch metrics broken down by channels and timeseries and return a 200", done =>
				request("https://localhost:8080")
					.get("/metrics/timeseries/day/channels?startDate=2014-07-15T00:00:00.000Z&endDate=2014-07-19T00:00:00.000Z")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(200)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							res.body.length.should.be.exactly(8);
							should.exist(res.body[0]._id.channelID);
							should.exist(res.body[0]._id.day);
							should.exist(res.body[0]._id.month);
							should.exist(res.body[0]._id.year);
							return done();
						}
					})
			);

			it("should fetch metrics for a particular channel broken down by timeseries and return a 200", done =>
				request("https://localhost:8080")
					.get("/metrics/timeseries/day/channels/222222222222222222222222?startDate=2014-07-15T00:00:00.000Z&endDate=2014-07-19T00:00:00.000Z")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(200)
					.end((err, res) => {
						if (err) {
							console.log(err.stack);
							return done(err);
						} else {
							res.body.length.should.be.exactly(4);
							should.exist(res.body[0]._id.channelID);
							should.exist(res.body[0]._id.day);
							should.exist(res.body[0]._id.month);
							should.exist(res.body[0]._id.year);
							res.body[0]._id.channelID.should.be.exactly("222222222222222222222222");
							return done();
						}
					})
			);

			it("should fetch metrics for only the channels that a user can view", done =>
				request("https://localhost:8080")
					.get("/metrics?startDate=2014-07-15T00:00:00.000Z&endDate=2014-07-19T00:00:00.000Z")
					.set("auth-username", testUtils.nonRootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(200)
					.end((err, res) => {
						if (err) {
							return done(err);
						} else {
							res.body.length.should.be.exactly(1);
							res.body[0].total.should.be.exactly(5);
							return done();
						}
					})
			);

			return it("should return a 401 when a channel isn't found", done =>
				request("https://localhost:8080")
					.get("/metrics/channels/333333333333333333333333?startDate=2014-07-15T00:00:00.000Z&endDate=2014-07-19T00:00:00.000Z")
					.set("auth-username", testUtils.rootUser.email)
					.set("auth-ts", authDetails.authTS)
					.set("auth-salt", authDetails.authSalt)
					.set("auth-token", authDetails.authToken)
					.expect(401)
					.end((err, res) => {
						if (err) {
							console.log(err.stack);
							return done(err);
						} else {
							return done();
						}
					})
			);
		});
	})
);
