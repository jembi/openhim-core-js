import should from "should";
import config from "../../lib/config/config";
config.email = config.get('email');
config.smsGateway = config.get('smsGateway');
let contact = require("../../lib/contact");
let sinon = require("sinon");
let nodemailer = require("nodemailer");

describe("Contact Users", function() {
  describe("config", function() {
    it("default config should contain email config fields", function(done) {
      config.email.fromAddress.should.exist;
      config.email.nodemailer.should.exist;
      config.email.nodemailer.service.should.exist;
      config.email.nodemailer.auth.should.exist;
      config.email.nodemailer.auth.user.should.exist;
      config.email.nodemailer.auth.pass.should.exist;
      return done();
    });

    return it("default config should contain smsGateway config fields", function(done) {
      config.smsGateway.should.exist;
      config.smsGateway.provider.should.exist;
      config.smsGateway.config.should.exist;
      config.smsGateway.config.user.should.exist;
      config.smsGateway.config.pass.should.exist;
      config.smsGateway.config.apiID.should.exist;
      return done();
    });
  });

  return describe("sendEmail", function() {
    let sandbox = null;

    beforeEach(function(done) {
      sandbox = sinon.sandbox.create();
      return done();
    });

    afterEach(function(done) {
      sandbox.restore();
      return done();
    });

    it("should propagate errors from nodemailer", function(done) {
      // Stub nodemailer and the transport
      let transportStub = {sendMail: sandbox.stub().yields(new Error("Nodemailer error"))};
      let nodemailerStub = sandbox.stub(nodemailer, "createTransport").returns(transportStub);

      // Execute the test method
      return contact.sendEmail("test@example.com", "Test", "Hello world", "<h1>Hello world</h1>", function(err) {
        should.exist(err);
        should.equal(err.message, "Nodemailer error");
        return done();
      });
    });

    it("should send mail with the correct fields", function(done) {
      let expectedFields = {
        from: "address@example.com",
        to:  "user@example.com",
        subject: "Test",
        text: "Hello world",
        html: "<h1>Hello world</h1>"
      };

      // Stub the sendMail function
      let sendMailStub = sandbox.stub();
      sendMailStub.yields(new Error("Incorrect fields"));
      sendMailStub.withArgs(sinon.match(expectedFields), sinon.match.func).yields(null);

      // Stub nodemailer and the transport
      let transportStub = {sendMail: sendMailStub};
      let nodemailerStub = sandbox.stub(nodemailer, "createTransport").returns(transportStub);

      // Execute the test method
      return contact.sendEmail(expectedFields.to, expectedFields.subject, expectedFields.text, expectedFields.html, function(err) {
        should.not.exist(err);
        return done();
      });
    });

    it("should send mail with the correct fields with old config", function(done) {
      // Temporarily switch config
      let emailConfig = config.email;
      config.email = null;
      config.nodemailer = emailConfig.nodemailer;

      let expectedFields = {
        from: "user@gmail.com",
        to:  "user@example.com",
        subject: "Test",
        text: "Hello world",
        html: "<h1>Hello world</h1>"
      };

      // Stub the sendMail function
      let sendMailStub = sandbox.stub();
      sendMailStub.yields(new Error("Incorrect fields"));
      sendMailStub.withArgs(sinon.match(expectedFields), sinon.match.func).yields(null);

      // Stub nodemailer and the transport
      let transportStub = {sendMail: sendMailStub};
      let nodemailerStub = sandbox.stub(nodemailer, "createTransport").returns(transportStub);

      // Execute the test method
      return contact.sendEmail(expectedFields.to, expectedFields.subject, expectedFields.text, expectedFields.html, function(err) {
        should.not.exist(err);
        // Restore config
        config.nodemailer = null;
        config.email = emailConfig;
        return done();
      });
    });

    return it("should return an error when no config is found", function(done) {
      // Temporarily remove email config
      let emailConfig = config.email;
      config.email = null;

      // Execute the test method
      return contact.sendEmail("test@example.com", "Test", "Hello world", "<h1>Hello world</h1>", function(err) {
        should.exist(err);
        should.equal(err.message, "No email config found");
        // Restore config
        config.email = emailConfig;
        return done();
      });
    });
  });
});
