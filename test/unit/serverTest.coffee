should = require 'should'
sinon = require 'sinon'
http = require 'http'
server = require '../../lib/server'
moment = require 'moment'

describe 'Server tests', ->
  ports =
    httpPort: 7001
    httpsPort: 7000
    apiPort: 7080
    rerunPort: 7781
    tcpHttpReceiverPort: 7782
    pollingPort: 7783
    auditUDPPort: 7784

  before (done) -> server.start ports, done

  after (done) -> server.stop done

  it 'should be able to restart the server in under 5 seconds', (done) ->
    future = moment().add '5', 's'
    server.stop ->
      server.start ports, ->
        (moment().isBefore future).should.be.true
        done()
