fs = require "fs"
should = require "should"
sinon = require "sinon"
http = require "http"
stats = require "../../lib/middleware/stats"
testUtils = require "../testUtils"
FakeServer = require "../fakeTcpServer"
timer = new Date()
config = require '../../lib/config/config'
application = config.get 'application'
os = require "os"
domain = os.hostname() + '.' + application.name



describe "Stats Middleware ", ->
  s = {}

  before (done) ->
    s = new FakeServer()
    s.start done

  after ->
    s.stop()


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
  ctx.transactionStatus = "Successful"

#  TODO add orchestrations and non primary routes to the ctx object
  ctx.mediatorResponse = orchestrations: [
    name: "Lab API"
    request:
      path: "api/patient/lab"
      headers:
        "Content-Type": "text/plain"
      body: "<route request>"
      method: "POST"
      timestamp: 1412257881904
    response:
      status: "200"
      headers: {}
      body: "<route response>"
      timestamp: 1412257881909
  ]



  it "should increment the transaction counter", (done) ->
    this.timeout = 400000
    stats.incrementTransactionCount ctx, () ->
      s.expectMessage domain + '.channels:1|c', ->
        s.expectMessage domain + '.channels.Successful:1|c', ->
          s.expectMessage domain + '.channels.ckjhfjwedsnfdsf:1|c', ->
            s.expectMessage domain + '.channels.ckjhfjwedsnfdsf.orchestrations.Lab API:1|c', ->
              s.expectMessage domain + '.channels.ckjhfjwedsnfdsf.orchestrations.Lab API.statusCodes.200:1|c', ->
                s.expectMessage domain + '.channels.ckjhfjwedsnfdsf.statuses.Successful.orchestrations.Lab API:1|c', ->
                  s.expectMessage domain + '.channels.ckjhfjwedsnfdsf.statuses.Successful.orchestrations.Lab API.statusCodes.200:1|c', done

#  it "Should measure transaction duration", (done) ->
#    this.timeout = 900000
#    stats.timer = new Date()
#    stats.measureTransactionDuration ctx, () ->
#      s._packetsReceived.forEach (item, index) ->
#        console.log s._packetsReceived[index].toString()
#      s.expectMessage '', done





