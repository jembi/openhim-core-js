should = require "should"
sinon = require "sinon"
http = require "http"

server = require "../lib/server"

describe "OpenHIM server", ->
	it.skip "should start the http server", ->

		server.start 5000

		http.get "http://localhost:5000/", (res) ->
			res.statusCode.should.eql(200);

	it.skip "should start the https server", ->
		server.start null, 5001
