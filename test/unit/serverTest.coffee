should = require 'should'
sinon = require 'sinon'
http = require 'http'
server = require '../../lib/server'
moment = require 'moment'

describe 'Server tests', ->

	before (done) -> server.start 6001, 6000, 9080, 8786, 8787, 8788, done

	after (done) -> server.stop done

	it 'should be able to restart the server in under 5 seconds', (done) ->
		future = moment().add '5', 's'
		server.stop ->
			server.start 6001, 6000, 9080, 8786, 8787, 8788, ->
				(moment().isBefore future).should.be.true
				done()