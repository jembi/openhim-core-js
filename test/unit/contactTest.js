/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import should from "should";
import sinon from "sinon";
import nodemailer from "nodemailer";
import contact from "../../lib/contact";
import config from "../../lib/config/config";

config.email = config.get("email");
config.smsGateway = config.get("smsGateway");

describe("Contact Users", () => {
	describe("config", () => {
		it("default config should contain email config fields", (done) => {
			config.email.fromAddress.should.exist;
			config.email.nodemailer.should.exist;
			config.email.nodemailer.service.should.exist;
			config.email.nodemailer.auth.should.exist;
			config.email.nodemailer.auth.user.should.exist;
			config.email.nodemailer.auth.pass.should.exist;
			return done();
		});

		return it("default config should contain smsGateway config fields", (done) => {
			config.smsGateway.should.exist;
			config.smsGateway.provider.should.exist;
			config.smsGateway.config.should.exist;
			config.smsGateway.config.user.should.exist;
			config.smsGateway.config.pass.should.exist;
			config.smsGateway.config.apiID.should.exist;
			return done();
		});
	});

	return describe("sendEmail", () => {
		let sandbox = null;

		beforeEach((done) => {
			sandbox = sinon.sandbox.create();
			return done();
		});

		afterEach((done) => {
			sandbox.restore();
			return done();
		});

		it("should propagate errors from nodemailer", (done) => {
			// Stub nodemailer and the transport
			const transportStub = { sendMail: sandbox.stub().yields(new Error("Nodemailer error")) };
			const nodemailerStub = sandbox.stub(nodemailer, "createTransport").returns(transportStub);

			// Execute the test method
			return contact.sendEmail("test@example.com", "Test", "Hello world", "<h1>Hello world</h1>", (err) => {
				should.exist(err);
				should.equal(err.message, "Nodemailer error");
				return done();
			});
		});

		it("should send mail with the correct fields", (done) => {
			const expectedFields = {
				from: "address@example.com",
				to: "user@example.com",
				subject: "Test",
				text: "Hello world",
				html: "<h1>Hello world</h1>"
			};

			// Stub the sendMail function
			const sendMailStub = sandbox.stub();
			sendMailStub.yields(new Error("Incorrect fields"));
			sendMailStub.withArgs(sinon.match(expectedFields), sinon.match.func).yields(null);

			// Stub nodemailer and the transport
			const transportStub = { sendMail: sendMailStub };
			const nodemailerStub = sandbox.stub(nodemailer, "createTransport").returns(transportStub);

			// Execute the test method
			return contact.sendEmail(expectedFields.to, expectedFields.subject, expectedFields.text, expectedFields.html, (err) => {
				should.not.exist(err);
				return done();
			});
		});

		it("should send mail with the correct fields with old config", (done) => {
			// Temporarily switch config
			const emailConfig = config.email;
			config.email = null;
			config.nodemailer = emailConfig.nodemailer;

			const expectedFields = {
				from: "user@gmail.com",
				to: "user@example.com",
				subject: "Test",
				text: "Hello world",
				html: "<h1>Hello world</h1>"
			};

			// Stub the sendMail function
			const sendMailStub = sandbox.stub();
			sendMailStub.yields(new Error("Incorrect fields"));
			sendMailStub.withArgs(sinon.match(expectedFields), sinon.match.func).yields(null);

			// Stub nodemailer and the transport
			const transportStub = { sendMail: sendMailStub };
			const nodemailerStub = sandbox.stub(nodemailer, "createTransport").returns(transportStub);

			// Execute the test method
			return contact.sendEmail(expectedFields.to, expectedFields.subject, expectedFields.text, expectedFields.html, (err) => {
				should.not.exist(err);
				// Restore config
				config.nodemailer = null;
				config.email = emailConfig;
				return done();
			});
		});

		return it("should return an error when no config is found", (done) => {
			// Temporarily remove email config
			const emailConfig = config.email;
			config.email = null;

			// Execute the test method
			return contact.sendEmail("test@example.com", "Test", "Hello world", "<h1>Hello world</h1>", (err) => {
				should.exist(err);
				should.equal(err.message, "No email config found");
				// Restore config
				config.email = emailConfig;
				return done();
			});
		});
	});
});
