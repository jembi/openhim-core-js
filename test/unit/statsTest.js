// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import fs from "fs";
import should from "should";
import sinon from "sinon";
import http from "http";
import stats from "../../lib/stats";
import testUtils from "../testUtils";
import FakeServer from "../fakeTcpServer";
let timer = new Date();
import config from '../../lib/config/config';
let application = config.get('application');
let os = require("os");
let domain = os.hostname() + '.' + application.name;

describe("Stats Middleware ", function() {
  let s = {};

  beforeEach(function(done) {
    s = new FakeServer();
    return s.start(done);
  });

  afterEach(() => s.stop());

  let channel = {
    _id: "ckjhfjwedsnfdsf",
    name: "Mock endpoint",
    urlPattern: ".+",
    routes: [{
      secured: true,
      host: 'localhost',
      port: 9877,
      primary: true,
      cert: fs.readFileSync('test/resources/server-tls/cert.pem')
    }
    ]
  };

  let requestTimestamp = (new Date()).toString();
  let ctx = new Object();
  ctx.authorisedChannel = channel;
  ctx.request = new Object();
  ctx.response = new Object();
  ctx.response.set = function() {};
  ctx.path = (ctx.request.url = "/test");
  ctx.request.method = "GET";
  ctx.requestTimestamp = requestTimestamp;
  ctx.transactionStatus = "Successful";
  ctx.routes = [];
  ctx.mediatorResponse = new Object();
  ctx.mediatorResponse.properties =
    {name: 'primary mediator'};
  ctx.mediatorResponse.metrics = [];
  ctx.mediatorResponse.orchestrations = [{
    name: "Lab API",
    group: "group",
    request: {
      path: "api/patient/lab",
      headers: {
        "Content-Type": "text/plain"
      },
      body: "<route request>",
      method: "POST",
      timestamp: 1412257881904
    },
    response: {
      status: "200",
      headers: {},
      body: "<route response>",
      timestamp: 1412257881909
    },
    metrics : []
  }
  ];

//Non Primary routes
  ctx.routes.push({
    name: "secondary route",
    request: {
      path: "api/patient/lab",
      headers: {
        "Content-Type": "text/plain"
      },
      body: "<route request>",
      method: "POST",
      timestamp: 1412257881904
    },
    "response": {
      "status": 200,
      "headers": {
        "content-type": "application\/json"
      },
      "body": "Primary Route Reached",
      "timestamp": 1423489768398
    },

    orchestrations: [{
      name: "Lab API",
      group: "group",
      request: {
        path: "api/patient/lab",
        headers: {
          "Content-Type": "text/plain"
        },
        body: "<route request>",
        method: "POST",
        timestamp: 1412257881904
      },
      response: {
        status: "200",
        headers: {},
        body: "<route response>",
        timestamp: 1412257881909
      }
    }
    ]});

  // Adding Custom Metrics
  ctx.mediatorResponse.metrics.push({
    name: 'my-counter-metric',
    type: 'counter',
    value: 1
  });
  ctx.mediatorResponse.metrics.push({
    name: 'my-gauge-metric',
    type: 'gauge',
    value: 11
  });
  ctx.mediatorResponse.metrics.push({
    name: 'my-timer-metric',
    type: 'timer',
    value: 1522
  });


  // Has no groups
  requestTimestamp = (new Date()).toString();
  let ctx2 = new Object();
  ctx2.authorisedChannel = channel;
  ctx2.request = new Object();
  ctx2.response = new Object();
  ctx2.response.set = function() {};
  ctx2.path = (ctx2.request.url = "/test");
  ctx2.request.method = "GET";
  ctx2.requestTimestamp = requestTimestamp;
  ctx2.transactionStatus = "Successful";
  ctx2.routes = [];
  ctx2.mediatorResponse = new Object();
  ctx2.mediatorResponse.properties =
    {name: 'primary mediator'};
  ctx2.mediatorResponse.metrics = [];
  ctx2.mediatorResponse.orchestrations = [{
    name: "Lab API",
    request: {
      path: "api/patient/lab",
      headers: {
        "Content-Type": "text/plain"
      },
      body: "<route request>",
      method: "POST",
      timestamp: 1412257881904
    },
    response: {
      status: "200",
      headers: {},
      body: "<route response>",
      timestamp: 1412257881909
    },
    metrics : []
  }
  ];

  // Non Primary routes
  ctx2.routes.push({
    name: "secondary route",
    request: {
      path: "api/patient/lab",
      headers: {
        "Content-Type": "text/plain"
      },
      body: "<route request>",
      method: "POST",
      timestamp: 1412257881904
    },
    "response": {
      "status": 200,
      "headers": {
        "content-type": "application\/json"
      },
      "body": "Primary Route Reached",
      "timestamp": 1423489768398
    },

    orchestrations: [{
      name: "Lab API",
      request: {
        path: "api/patient/lab",
        headers: {
          "Content-Type": "text/plain"
        },
        body: "<route request>",
        method: "POST",
        timestamp: 1412257881904
      },
      response: {
        status: "200",
        headers: {},
        body: "<route response>",
        timestamp: 1412257881909
      }
    }
    ]});

  // Adding Custom Metrics
  ctx2.mediatorResponse.metrics.push({
    name: 'my-counter-metric',
    type: 'counter',
    value: 1
  });
  ctx2.mediatorResponse.metrics.push({
    name: 'my-gauge-metric',
    type: 'gauge',
    value: 11
  });
  ctx2.mediatorResponse.metrics.push({
    name: 'my-timer-metric',
    type: 'timer',
    value: 1522
  });

  it("should increment the transaction counter", done =>
    stats.incrementTransactionCount(ctx, () =>
      stats.incrementTransactionCount(ctx2, () =>
        stats.nonPrimaryRouteRequestCount(ctx, ctx.routes[0], () =>
          stats.nonPrimaryRouteRequestCount(ctx2, ctx2.routes[0], () =>
            s.expectMessage(domain + '.channels:1|c', () =>
              s.expectMessage(domain + '.channels.Successful:1|c', () =>
                s.expectMessage(domain + '.channels.ckjhfjwedsnfdsf:1|c', () =>
                  s.expectMessage(domain + '.channels.ckjhfjwedsnfdsf.orchestrations.group.Lab API:1|c', () =>
                    s.expectMessage(domain + '.channels.ckjhfjwedsnfdsf.orchestrations.group.Lab API.statusCodes.200:1|c', () =>
                      s.expectMessage(domain + '.channels.ckjhfjwedsnfdsf.statuses.Successful.orchestrations.group.Lab API:1|c', () =>
                        s.expectMessage(domain + '.channels.ckjhfjwedsnfdsf.statuses.Successful.orchestrations.group.Lab API.statusCodes.200:1|c', () =>
                          s.expectMessage(domain + '.channels.ckjhfjwedsnfdsf.primary mediator.mediator_metrics.my-counter-metric:1|c', () =>
                            s.expectMessage(domain + '.channels.ckjhfjwedsnfdsf.primary mediator.mediator_metrics.my-gauge-metric:11|g', () =>
                              s.expectMessage(domain + '.channels.ckjhfjwedsnfdsf.primary mediator.mediator_metrics.my-timer-metric:1522|ms', () =>
                                s.expectMessage(domain + '.channels.ckjhfjwedsnfdsf.orchestrations.Lab API:1|c', () =>
                                  s.expectMessage(domain + '.channels.ckjhfjwedsnfdsf.orchestrations.Lab API.statusCodes.200:1|c', () =>
                                    s.expectMessage(domain + '.channels.ckjhfjwedsnfdsf.statuses.Successful.orchestrations.Lab API:1|c', () => s.expectMessage(domain + '.channels.ckjhfjwedsnfdsf.statuses.Successful.orchestrations.Lab API.statusCodes.200:1|c', done))
                                  )
                                )
                              )
                            )
                          )
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
    )
  );

  return it("Should measure transaction duration", function(done) {
    ctx.timer = 10;
    return stats.measureTransactionDuration(ctx, () =>
      stats.measureTransactionDuration(ctx2, () =>
        stats.nonPrimaryRouteDurations(ctx, ctx.routes[0], () =>
          stats.nonPrimaryRouteDurations(ctx2, ctx2.routes[0], () =>
            s.expectMessage(domain + '.channels:10|ms', () =>
              s.expectMessage(domain + '.channels.ckjhfjwedsnfdsf.orchestrations.group.Lab API:5|ms', () =>
                s.expectMessage(domain + '.channels.ckjhfjwedsnfdsf.orchestrations.group.Lab API.statusCodes.200:5|ms', () =>
                  s.expectMessage(domain + '.channels.Successful:10|ms', () =>
                    s.expectMessage(domain + '.channels.ckjhfjwedsnfdsf:10|ms', () =>
                      s.expectMessage(domain + '.channels.ckjhfjwedsnfdsf.statuses.Successful:10|ms', () =>
                        s.expectMessage(domain + '.channels.ckjhfjwedsnfdsf.nonPrimaryRoutes.secondary route:10|ms', () =>
                          s.expectMessage(domain + '.channels.ckjhfjwedsnfdsf.nonPrimaryRoutes.secondary route.statusCodes.200:10|ms', () =>
                            s.expectMessage(domain + '.channels.ckjhfjwedsnfdsf.nonPrimaryRoutes.secondary route.orchestrations.group.Lab API:5|ms', () =>
                              s.expectMessage(domain + '.channels.ckjhfjwedsnfdsf.orchestrations.Lab API:5|ms', () =>
                                s.expectMessage(domain + '.channels.ckjhfjwedsnfdsf.orchestrations.Lab API.statusCodes.200:5|ms', () => s.expectMessage(domain + '.channels.ckjhfjwedsnfdsf.nonPrimaryRoutes.secondary route.orchestrations.Lab API:5|ms', done))
                              )
                            )
                          )
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
    );
  });
});
