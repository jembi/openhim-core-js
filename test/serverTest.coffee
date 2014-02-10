should = require "should"
sinon = require "sinon"
http = require "http"

server = require "../lib/server"

describe "OpenHIM server", ->
	it "should start the http server", ->
		server.start 5000

		http.get "http://localhost:5000/", (res) ->
			res.status.should.be.exactly 200

	it.skip "should start the https server", ->
		server.start null, 5001
