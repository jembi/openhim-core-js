should = require 'should'
sinon = require 'sinon'
http = require 'http'
server = require '../../lib/server'
moment = require 'moment'

describe 'Server tests', ->

  before (done) -> server.start 7001, 7000, 7080, 7781, 7782, 7783, done

  after (done) -> server.stop done

  it 'should be able to restart the server in under 5 seconds', (done) ->
    future = moment().add '5', 's'
    server.stop ->
      server.start 7001, 7000, 7080, 7781, 7782, 7783, ->
        (moment().isBefore future).should.be.true
        done()