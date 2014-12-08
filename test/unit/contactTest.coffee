should = require "should"
config = require "../../lib/config/config"
config.nodemailer = config.get('nodemailer')
config.smsGateway = config.get('smsGateway')

describe "Contact Users", ->
  describe "config", ->
    it "default config should contain nodemailer config fields", (done) ->
      config.nodemailer.should.exist
      config.nodemailer.service.should.exist
      config.nodemailer.auth.should.exist
      config.nodemailer.auth.user.should.exist
      config.nodemailer.auth.pass.should.exist
      done()

    it "default config should contain smsGateway config fields", (done) ->
      config.smsGateway.should.exist
      config.smsGateway.provider.should.exist
      config.smsGateway.config.should.exist
      config.smsGateway.config.user.should.exist
      config.smsGateway.config.pass.should.exist
      config.smsGateway.config.apiID.should.exist
      done()
