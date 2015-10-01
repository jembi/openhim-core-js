should = require 'should'
request = require 'supertest'
config = require '../../lib/config/config'
config.authentication = config.get('authentication')
config.tlsClientLookup = config.get('tlsClientLookup')
Channel = require('../../lib/model/channels').Channel
Client = require('../../lib/model/clients').Client
testUtils = require '../testUtils'
server = require '../../lib/server'
auth = require("../testUtils").auth


describe 'Visualizer Integration Tests', ->
  mockServer = null
  mockServer2 = null
  authDetails = {}

  channelName = 'TEST DATA - Mock endpoint'
  secRouteName = 'Test secondary route'
  mockResponse = 'test for visualizer'

  before (done) ->
    config.authentication.enableMutualTLSAuthentication = false
    config.authentication.enableBasicAuthentication = true

    # Setup some test data
    channel1 = new Channel
      name: channelName
      urlPattern: 'test/mock'
      allow: [ 'PoC' ]
      routes: [
        {
          name: 'test route'
          host: 'localhost'
          port: 1232
          primary: true
        }, {
          name: secRouteName
          host: 'localhost'
          port: 1233
        }
      ]
      rewriteUrls: true
    channel1.save (err) ->
      testAppDoc =
        clientID: 'testApp'
        clientDomain: 'test-client.jembi.org'
        name: 'TEST Client'
        roles:
          [
            'OpenMRS_PoC'
            'PoC'
          ]
        passwordAlgorithm: 'sha512'
        passwordHash: '28dce3506eca8bb3d9d5a9390135236e8746f15ca2d8c86b8d8e653da954e9e3632bf9d85484ee6e9b28a3ada30eec89add42012b185bd9a4a36a07ce08ce2ea'
        passwordSalt: '1234567890'
        cert: ''

      client = new Client testAppDoc
      client.save (error, newAppDoc) ->
        auth.setupTestUsers (err) ->
          # Create mock endpoint to forward requests to
          mockServer = testUtils.createMockServer 200, mockResponse, 1232, ->
            mockServer2 = testUtils.createMockServer 200, mockResponse, 1233, done

  after (done) ->
    Channel.remove { name: 'TEST DATA - Mock endpoint' }, ->
      Client.remove { clientID: 'testApp' }, ->
        auth.cleanupTestUsers (err) ->
          mockServer.close ->
            mockServer2.close done


  beforeEach (done) ->
    server.start { httpPort: 5001, apiPort: 8080 }, ->
      authDetails = auth.getAuthDetails()
      done()

  afterEach (done) -> server.stop done


  it 'should create visualizer events', (done) ->
    startTime = new Date()

    request('http://localhost:5001')
      .get('/test/mock')
      .auth('testApp', 'password')
      .expect(200)
      .end (err, res) ->
        return done err if err

        request('https://localhost:8080')
          .get("/visualizer/events/#{+startTime}")
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .end (err, res) ->
            return done err if err

            res.body.should.have.property 'events'
            res.body.events.length.should.be.exactly 6

            events = (res.body.events.map (event) -> "#{event.comp}-#{event.ev}")
            events.should.containEql "#{channelName}-start"
            events.should.containEql "#{channelName}-end"
            events.should.containEql "channel-#{channelName}-start"
            events.should.containEql "channel-#{channelName}-end"
            events.should.containEql "route-#{secRouteName}-start"
            events.should.containEql "route-#{secRouteName}-end"

            done()

  it "should sort visualizer events according to 'ts' field ascending", (done) ->
    startTime = new Date()

    request('http://localhost:5001')
      .get('/test/mock')
      .auth('testApp', 'password')
      .expect(200)
      .end (err, res) ->
        return done err if err

        request('https://localhost:8080')
          .get("/visualizer/events/#{+startTime}")
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .end (err, res) ->
            return done err if err

            res.body.should.have.property 'events'
            res.body.events.length.should.be.exactly 6

            (res.body.events.map (event) -> event.ts).reduce (a, b) ->
              should(a <= b).be.true()
              return b

            done()

  it 'should set the transaction status as a string', (done) ->
    startTime = new Date()

    request('http://localhost:5001')
      .get('/test/mock')
      .auth('testApp', 'password')
      .expect(200)
      .end (err, res) ->
        return done err if err

        request('https://localhost:8080')
          .get("/visualizer/events/#{+startTime}")
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .end (err, res) ->
            return done err if err

            res.body.should.have.property 'events'
            res.body.events.length.should.be.exactly 6

            events = (res.body.events.map (event) -> event.status)
            events.should.containEql 'success'

            done()
