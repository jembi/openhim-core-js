fs = require "fs"
should = require "should"
sinon = require "sinon"
tlsAuthentication = require "../../lib/middleware/tlsAuthentication"
Client = require("../../lib/model/clients").Client
testUtils = require "../testUtils"
config = require "../../lib/config/config"
config.tlsClientLookup = config.get('tlsClientLookup')
Keystore = require('../../lib/model/keystore').Keystore

describe "tlsAuthentication.coffee", ->

  beforeEach (done) ->
    testUtils.setupTestKeystore -> done()

  afterEach (done) ->
    testUtils.cleanupTestKeystore -> done()

  describe ".getServerOptions", ->

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

  describe ".clientLookup", ->

    it "should find a client in the keystore up the chain", (done) ->
      testClientDoc =
        clientID: "testApp"
        clientDomain: "trust2.org"
        name: "TEST Client"
        roles:
          [
            "OpenMRS_PoC"
            "PoC"
          ]
        passwordHash: ""
        certFingerprint: "8F:AB:2A:51:84:F2:ED:1B:13:2B:41:21:8B:78:D4:11:47:84:73:E6"

      client = new Client testClientDoc
      client.save ->
        config.tlsClientLookup.type = 'in-chain'
        promise = tlsAuthentication.clientLookup 'wont_be_found', 'test', 'trust2.org'
        promise.then (result) ->
          result.should.have.property 'clientID', client.clientID
          Client.remove {}, ->
            done()

    it "should resolve even if no cert are found in the keystore", (done) ->
      config.tlsClientLookup.type = 'in-chain'
      promise = tlsAuthentication.clientLookup 'you.wont.find.me', 'me.either'
      promise.then -> done()

    it "should resolve when the keystore.ca is empty", (done) ->
      Keystore.findOneAndUpdate {}, { ca: [] }, ->
        config.tlsClientLookup.type = 'in-chain'
        promise = tlsAuthentication.clientLookup 'you.wont.find.me', 'me.either'
        promise.then -> done()
