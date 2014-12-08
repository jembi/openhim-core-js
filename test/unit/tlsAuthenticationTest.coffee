fs = require "fs"
should = require "should"
sinon = require "sinon"
tlsAuthentication = require "../../lib/middleware/tlsAuthentication"
Client = require("../../lib/model/clients").Client

describe "Setup mutual TLS", ->
  it "should add all trusted certificates and enable mutual auth from all clients to server options if mutual auth is enabled", ->

    cert = (fs.readFileSync "test/resources/client-tls/cert.pem").toString()

    testAppDoc =
      clientID: "testApp"
      clientDomain: "test-client.jembi.org"
      name: "TEST Client"
      roles:
        [
          "OpenMRS_PoC"
          "PoC"
        ]
      passwordHash: ""
      cert: cert

    app = new Client testAppDoc
    app.save (error, newAppDoc) ->
      tlsAuthentication.getServerOptions true, (err, options) ->
        options.ca.should.be.ok
        options.ca.should.be.an.Array
        options.ca.should.containEql cert
        options.requestCert.should.be.true
        options.rejectUnauthorized.should.be.false


  it "should NOT have mutual auth options set if mutual auth is disabled", ->
    tlsAuthentication.getServerOptions false, (err, options) ->
      options.should.not.have.property "ca"
      options.should.not.have.property "requestCert"
      options.should.not.have.property "rejectUnauthorized"
  it "should add the servers key and certificate to the server options", ->
    tlsAuthentication.getServerOptions false, (err, options) ->
      options.cert.should.be.ok
      options.key.should.be.ok

  after (done) ->
    Client.remove { clientID: "testApp" }, ->
      done()
