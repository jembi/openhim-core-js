fs = require "fs"
should = require "should"
sinon = require "sinon"
http = require "http"
stats = require "../../lib/middleware/stats"
testUtils = require "../testUtils"



describe "Stats Middleware ", ->

  channel =
    _id: "ckjhfjwedsnfdsf"
    name: "Mock endpoint"
    urlPattern: ".+"
    routes: [
      secured: true
      host: 'localhost'
      port: 9877
      primary: true
      cert: fs.readFileSync 'test/resources/server-tls/cert.pem'
    ]

  requestTimestamp = (new Date()).toString()
  ctx = new Object()
  ctx.authorisedChannel = channel
  ctx.request = new Object()
  ctx.response = new Object()
  ctx.response.set = ->
  ctx.path = ctx.request.url = "/test"
  ctx.request.method = "GET"
  ctx.requestTimestamp = requestTimestamp

  it "should increment the transaction counter", (done) ->
    mockudp = require "mock-udp"
    scope = mockudp('127.0.0.1:8125')
    stats.incrementTransactionCounthtop ctx, (err) ->
      scope.buffer
      scope.done()
      done()

