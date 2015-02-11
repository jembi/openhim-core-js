fs = require "fs"
should = require "should"
sinon = require "sinon"
tlsAuthentication = require "../../lib/middleware/tlsAuthentication"
Client = require("../../lib/model/clients").Client
testUtils = require "../testUtils"

describe "Setup mutual TLS", ->

  before (done) ->
    testUtils.setupTestKeystore -> done()

  after (done) ->
    testUtils.cleanupTestKeystore -> done()

  it "should add all trusted certificates and enable mutual auth from all clients to server options if mutual auth is enabled", (done) ->
    tlsAuthentication.getServerOptions true, (err, options) ->
      options.ca.should.be.ok
      options.ca.should.be.an.Array
      options.ca.should.containEql (fs.readFileSync 'test/resources/trust-tls/cert1.pem').toString()
      options.ca.should.containEql (fs.readFileSync 'test/resources/trust-tls/cert2.pem').toString()
      options.requestCert.should.be.true
      options.rejectUnauthorized.should.be.false
      done()


  it "should NOT have mutual auth options set if mutual auth is disabled", (done) ->
    tlsAuthentication.getServerOptions false, (err, options) ->
      options.should.not.have.property "ca"
      options.should.not.have.property "requestCert"
      options.should.not.have.property "rejectUnauthorized"
      done()

  it "should add the servers key and certificate to the server options", (done) ->
    tlsAuthentication.getServerOptions false, (err, options) ->
      options.cert.should.be.ok
      options.key.should.be.ok
      done()
