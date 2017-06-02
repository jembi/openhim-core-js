Error.stackTraceLimit = Infinity;
let fs = require("fs");
let should = require("should");
let sinon = require("sinon");
let http = require("http");
let router = require("../../lib/middleware/router");
let testUtils = require("../testUtils");
let { Keystore } = require("../../lib/model/keystore");
let { Certificate } = require("../../lib/model/keystore");
let { Channel } = require("../../lib/model/channels");


describe("HTTP Router", function() {

  let requestTimestamp = (new Date()).toString();

  before(done =>
    testUtils.setupTestKeystore(null, null, [], () => done())
  );

  after(done =>
    testUtils.cleanupTestKeystore(() => done())
  );

  describe(".route", function() {

    it("should route an incomming request to the endpoints specific by the channel config", done =>
      testUtils.createMockServer(201, "Mock response body\n", 9876, function() {
        // Setup a channel for the mock endpoint
        let channel = {
          name: "Mock endpoint",
          urlPattern: ".+",
          routes: [{
                host: "localhost",
                port: 9876,
                primary: true
              }
              ]
        };

        let ctx = new Object();
        ctx.authorisedChannel = channel;
        ctx.request = new Object();
        ctx.response = new Object();
        ctx.response.set = function() {};
        ctx.path = (ctx.request.url = "/test");
        ctx.request.method = "GET";
        ctx.requestTimestamp = requestTimestamp;

        return router.route(ctx, function(err) {
          if (err) {
            return done(err);
          }

          ctx.response.status.should.be.exactly(201);
          ctx.response.body.toString().should.be.eql("Mock response body\n");
          ctx.response.header.should.be.ok;
          return done();
        });
      })
    );

    it('should route binary data', done =>
      testUtils.createStaticServer('test/resources', 9337 , function(server) {
        // Setup a channel for the mock endpoint
        let channel = {
          name: "Static Server Endpoint",
          urlPattern: "/openhim-logo-green.png",
          routes: [{
                host: "localhost",
                port: 9337,
                primary: true
              }
              ]
        };


        let ctx = new Object();
        ctx.authorisedChannel = channel;
        ctx.request = new Object();
        ctx.response = new Object();
        ctx.response.set = function() {};
        ctx.path = (ctx.request.url = "/openhim-logo-green.png");
        ctx.request.method = "GET";
        ctx.requestTimestamp = requestTimestamp;

        return router.route(ctx, function(err) {
          if (err) {
            return done(err);
          }
          ctx.response.type.should.equal('image/png');
          ctx.response.body.toString().should.equal((fs.readFileSync('test/resources/openhim-logo-green.png')).toString());
          return server.close(() => done());
        });
      })
    );


    let setupContextForMulticast = function() {
      // Setup channels for the mock endpoints
      let channel = {
        name: "Multicast 1",
        urlPattern: "test/multicast.+",
        routes: [{
              name: "non_primary_1",
              host: "localhost",
              port: 7777
            }
            , {
              name: "primary",
              host: "localhost",
              port: 8888,
              primary: true
            }
            , {
              name: "non_primary_2",
              host: "localhost",
              port: 9999
            }
            ]
      };
      let ctx = new Object();
      ctx.authorisedChannel = channel;
      ctx.request = new Object();
      ctx.response = new Object();
      ctx.response.set = function() {};
      ctx.path = (ctx.request.url = "/test/multicasting");
      ctx.request.method = "GET";
      ctx.requestTimestamp = requestTimestamp;
      return ctx;
    };

    it("should route an incomming https request to the endpoints specific by the channel config", done =>
      testUtils.createMockHTTPSServerWithMutualAuth(201, "Mock response body\n", 9877, function(server) {

        let keystore;
        return keystore = Keystore.findOne({}, function(err, keystore) {
          let cert = new Certificate({
            data: fs.readFileSync('test/resources/server-tls/cert.pem')});
          keystore.ca.push(cert);
          return keystore.save(function() {

            // Setup a channel for the mock endpoint
            let channel = {
              name: "Mock endpoint",
              urlPattern: ".+",
              routes: [{
                secured: true,
                host: 'localhost',
                port: 9877,
                primary: true,
                cert: cert._id
              }
              ]
            };

            let ctx = new Object();
            ctx.authorisedChannel = channel;
            ctx.request = new Object();
            ctx.response = new Object();
            ctx.response.set = function() {};
            ctx.path = (ctx.request.url = "/test");
            ctx.request.method = "GET";

            return router.route(ctx, function(err) {
              if (err) {
                return server.close(() => done(err));
              }

              ctx.response.status.should.be.exactly(201);
              ctx.response.body.toString().should.be.eql("Secured Mock response body\n");
              ctx.response.header.should.be.ok;
              return server.close(done);
            });
          });
        });
      })
    );

    it("should be denied access if the server doesn't know the client cert when using mutual TLS authentication", done =>
      testUtils.createMockHTTPSServerWithMutualAuth(201, "Mock response body\n", 9877, false, function(server) {
        // Setup a channel for the mock endpoint
        let channel = {
          name: "Mock endpoint mutual tls",
          urlPattern: ".+",
          allow: ['admin', 'aGroup', 'test'],
          authType: "public",
          routes: [
            {
              name: "test mock",
              secured: true,
              host: "localhost",
              port: 9877,
              primary: true
            }
          ],
          txViewAcl: "aGroup"
        };

        return (new Channel(channel)).save(function(err, ch1) {
          let ctx = new Object();
          ctx.authorisedChannel = ch1;
          ctx.request = new Object();
          ctx.response = new Object();
          ctx.response.set = function() {};
          ctx.path = (ctx.request.url = "/test");
          ctx.authorisedChannel._id = ch1._id;
          ctx.request.method = "GET";
          return router.route(ctx, function(err) {
            if (err) {
              logger.error(err);
              return server.close(() => done(err));
            }

            ctx.response.status.should.be.exactly(500);
            ctx.response.body.toString().should.be.eql("An internal server error occurred");
            if (server) {
              return server.close(done);
            } else {
              return done;
            }
          });
        });
      })
    );



    it("should be able to multicast to multiple endpoints but return only the response from the primary route", done =>
      testUtils.createMockServer(200, "Mock response body 1\n", 7777, () =>
        testUtils.createMockServer(201, "Mock response body 2\n", 8888, () =>
          testUtils.createMockServer(400, "Mock response body 3\n", 9999, function() {
            let ctx = setupContextForMulticast();
            return router.route(ctx, function(err) {
              if (err) {
                return done(err);
              }
              ctx.response.status.should.be.exactly(201);
              ctx.response.body.toString().should.be.eql("Mock response body 2\n");
              ctx.response.header.should.be.ok;
              return done();
            });
          })
        )
      )
    );

    it("should be able to multicast to multiple endpoints and set the responses for non-primary routes in ctx.routes", done =>
      testUtils.createMockServer(200, "Mock response body 1\n", 7750, () =>
        testUtils.createMockServer(201, "Mock response body 2\n", 7751, () =>
          testUtils.createMockServer(400, "Mock response body 3\n", 7752, function() {
            let ctx = setupContextForMulticast();
            return router.route(ctx, function(err) {
              if (err) {
                return done(err);
              }
              return setTimeout((function() {
                ctx.routes.length.should.be.exactly(2);
                ctx.routes[0].response.status.should.be.exactly(200);
                ctx.routes[0].response.body.toString().should.be.eql("Mock response body 1\n");
                ctx.routes[0].response.headers.should.be.ok;
                ctx.routes[0].request.path.should.be.exactly("/test/multicasting");
                ctx.routes[0].request.timestamp.should.be.exactly(requestTimestamp);
                ctx.routes[1].response.status.should.be.exactly(400);
                ctx.routes[1].response.body.toString().should.be.eql("Mock response body 3\n");
                ctx.routes[1].response.headers.should.be.ok;
                ctx.routes[1].request.path.should.be.exactly("/test/multicasting");
                ctx.routes[1].request.timestamp.should.be.exactly(requestTimestamp);
                return done();
              }), 100 * global.testTimeoutFactor);
            });
          })
        )
      )
    );


    it("should pass an error to next if there are multiple primary routes", done =>
      testUtils.createMockServer(200, "Mock response body 1\n", 4444, mock1 =>
        testUtils.createMockServer(201, "Mock response body 2\n", 5555, mock2 =>
          testUtils.createMockServer(400, "Mock response body 3\n", 6666, function(mock3) {
            // Setup channels for the mock endpoints
            let channel = {
              name: "Multi-primary",
              urlPattern: "test/multi-primary",
              routes: [{
                    host: "localhost",
                    port: 4444
                  }
                  , {
                    host: "localhost",
                    port: 5555,
                    primary: true
                  }
                  , {
                    host: "localhost",
                    port: 6666,
                    primary: true
                  }
                  ]
            };
            let ctx = new Object();
            ctx.authorisedChannel = channel;
            ctx.request = new Object();
            ctx.response = new Object();
            ctx.request.url = "/test/multi-primary";
            ctx.request.method = "GET";
            ctx.requestTimestamp = requestTimestamp;

            return router.route(ctx, function(err) {
              if (err) {
                err.message.should.be.exactly("Cannot route transaction: Channel contains multiple primary routes and only one primary is allowed");
                return mock1.close(() => mock2.close(() => mock3.close(done)));
              }
            });
          })
        )
      )
    );

    it("should forward PUT and POST requests correctly", function(done) {
      // Create mock endpoint to forward requests to
      let mockServer = testUtils.createMockServerForPost(200, 400, "TestBody");

      return mockServer.listen(3333, function() {
        // Setup a channel for the mock endpoint
        let channel = {
          name: "POST channel",
          urlPattern: ".+",
          routes: [{
                host: "localhost",
                port: 3333,
                primary: true
              }
              ]
        };

        let ctx = new Object();
        ctx.authorisedChannel = channel;
        ctx.request = new Object();
        ctx.response = new Object();
        ctx.response.set = function() {};
        ctx.request.url = "/test";
        ctx.request.method = "POST";
        ctx.requestTimestamp = requestTimestamp;
        ctx.body = "TestBody";

        return router.route(ctx, function(err) {
          if (err) {
            return done(err);
          }

          ctx.response.status.should.be.exactly(200);
          ctx.response.header.should.be.ok;
          return mockServer.close(done);
        });
      });
    });

    it("should send request params if these where received from the incoming request", function(done) {
      let mockServer;
      return mockServer = testUtils.createMockServer(201, "Mock response body\n", 9873, (function() {
        // Setup a channel for the mock endpoint
        let channel = {
          name: "Mock endpoint",
          urlPattern: ".+",
          routes: [{
                host: "localhost",
                port: 9873,
                primary: true
              }
              ]
        };

        let ctx = new Object();
        ctx.authorisedChannel = channel;
        ctx.request = new Object();
        ctx.response = new Object();
        ctx.response.set = function() {};
        ctx.path = "/test";
        ctx.request.url = "/test?parma1=val1&parma2=val2";
        ctx.request.method = "GET";
        ctx.request.querystring = "parma1=val1&parma2=val2";
        ctx.requestTimestamp = requestTimestamp;

        return router.route(ctx, function(err) {
          if (err) {
            return done(err);
          }
      });
      }), function(req, res) {
        req.url.should.eql("/test?parma1=val1&parma2=val2");
        return mockServer.close(done);
      });
    });

    it("should set mediator response object on ctx", function(done) {
      let mediatorResponse = {
        status: 'Successful',
        response: {
          status: 201,
          headers: {},
          body: 'Mock response body\n'
        },
        orchestrations: {
          name: 'Mock mediator orchestration',
          request: {
            path: '/some/path',
            method: 'GET',
            timestamp: (new Date()).toString()
          },
          response: {
            status: 200,
            body: 'Orchestrated response',
            timestamp: (new Date()).toString()
          }
        },
        properties: {
          prop1: 'val1',
          prop2: 'val2'
        }
      };

      return testUtils.createMockMediatorServer(201, mediatorResponse, 9878, function() {
        // Setup a channel for the mock endpoint
        let channel = {
          name: "Mock endpoint",
          urlPattern: ".+",
          routes: [{
            host: "localhost",
            port: 9878,
            primary: true
          }
          ]
        };

        let ctx = new Object();
        ctx.authorisedChannel = channel;
        ctx.request = new Object();
        ctx.response = new Object();
        ctx.path = (ctx.request.url = "/test");
        ctx.request.method = "GET";
        ctx.requestTimestamp = requestTimestamp;

        return router.route(ctx, function(err) {
          if (err) {
            return done(err);
          }

          try {
            ctx.response.status.should.be.exactly(201);
            ctx.mediatorResponse.should.exist;
            ctx.mediatorResponse.should.eql(mediatorResponse);
            return done();
          } catch (error) {
            err = error;
            return done(err);
          }
        });
      });
    });

    it("should set mediator response data as response to client", function(done) {
      let mediatorResponse = {
        status: 'Failed',
        response: {
          status: 400,
          headers: { 'content-type': 'text/xml', 'another-header': 'xyz' },
          body: 'Mock response body from mediator\n'
        },
        orchestrations: {
          name: 'Mock mediator orchestration',
          request: {
            path: '/some/path',
            method: 'GET',
            timestamp: (new Date()).toString()
          },
          response: {
            status: 200,
            body: 'Orchestrated response',
            timestamp: (new Date()).toString()
          }
        },
        properties: {
          prop1: 'val1',
          prop2: 'val2'
        }
      };

      return testUtils.createMockMediatorServer(201, mediatorResponse, 9879, function() {
        // Setup a channel for the mock endpoint
        let channel = {
          name: "Mock endpoint",
          urlPattern: ".+",
          routes: [{
            host: "localhost",
            port: 9879,
            primary: true
          }
          ]
        };


        let ctx = new Object();
        ctx.authorisedChannel = channel;
        ctx.request = new Object();
        ctx.response  = new Object();
        ctx.response.set = sinon.spy();
        ctx.path = (ctx.request.url = "/test");
        ctx.request.method = "GET";
        ctx.requestTimestamp = requestTimestamp;

        return router.route(ctx, function(err) {
          if (err) {
            return done(err);
          }
          try {
            ctx.response.status.should.be.exactly(400);
            ctx.response.body.should.be.exactly('Mock response body from mediator\n');
            ctx.response.type.should.be.exactly('text/xml');
            (ctx.response.set.calledWith('another-header', 'xyz')).should.be.true;
            return done();
          } catch (error) {
            err = error;
            return done(err);
          }
        });
      });
    });

    it("should set mediator response data for non-primary routes", function(done) {
      router.nonPrimaryRoutes = [];
      let mediatorResponse = {
        status: 'Failed',
        response: {
          status: 400,
          headers: {},
          body: 'Mock response body from mediator\n'
        },
        orchestrations: {
          name: 'Mock mediator orchestration',
          request: {
            path: '/some/path',
            method: 'GET',
            timestamp: (new Date()).toString()
          },
          response: {
            status: 200,
            body: 'Orchestrated response',
            timestamp: (new Date()).toString()
          }
        },
        properties: {
          prop1: 'val1',
          prop2: 'val2'
        }
      };

      return testUtils.createMockMediatorServer(201, mediatorResponse, 9888, () =>
        testUtils.createMockMediatorServer(201, mediatorResponse, 9889, function() {
          // Setup a channel for the mock endpoint
          let channel = {
            name: "Mock endpoint",
            urlPattern: ".+",
            routes: [{
                  name: 'non prim',
                  host: "localhost",
                  port: 9889
                }
                , {
                  name: 'primary',
                  host: "localhost",
                  port: 9888,
                  primary: true
                }
                ]
          };

          let ctx = new Object();
          ctx.authorisedChannel = channel;
          ctx.request = new Object();
          ctx.response = new Object();
          ctx.path = (ctx.request.url = "/test");
          ctx.request.method = "GET";
          ctx.requestTimestamp = requestTimestamp;


          return router.route(ctx, function(err) {
            if (err) {
              return done(err);
            }
            return setTimeout((function() {
              try {
                ctx.routes[0].response.body.toString().should.be.eql("Mock response body from mediator\n");
                ctx.routes[0].orchestrations.should.be.eql(mediatorResponse.orchestrations);
                ctx.routes[0].properties.should.be.eql(mediatorResponse.properties);
                return done();
              } catch (err) {
                return done(err);
              }
            }), 50 * global.testTimeoutFactor);
          });
        })
      );
    });

    return it("should set mediator response location header if present and status is not 3xx", function(done) {
      let mediatorResponse = {
        status: 'Successful',
        response: {
          status: 201,
          headers: {
            location: 'Patient/1/_history/1'
          },
          body: 'Mock response body\n'
        },
        orchestrations: {
          name: 'Mock mediator orchestration',
          request: {
            path: '/some/path',
            method: 'GET',
            timestamp: (new Date()).toString()
          },
          response: {
            status: 200,
            body: 'Orchestrated response',
            timestamp: (new Date()).toString()
          }
        },
        properties: {
          prop1: 'val1',
          prop2: 'val2'
        }
      };

      return testUtils.createMockMediatorServer(201, mediatorResponse, 9899, function() {
        // Setup a channel for the mock endpoint
        let channel = {
          name: "Mock endpoint",
          urlPattern: ".+",
          routes: [{
            host: "localhost",
            port: 9899,
            primary: true
          }
          ]
        };

        let ctx = new Object();
        ctx.authorisedChannel = channel;
        ctx.request = new Object();
        ctx.response = new Object();
        ctx.path = (ctx.request.url = "/test");
        ctx.request.method = "GET";
        ctx.requestTimestamp = requestTimestamp;
        let headerSpy = {};
        ctx.response.set = (k, v) => headerSpy[k] = v;

        return router.route(ctx, function(err) {
          if (err) {
            return done(err);
          }

          try {
            headerSpy.should.have.property('location', mediatorResponse.response.headers.location);
            return done();
          } catch (error) {
            err = error;
            return done(err);
          }
        });
      });
    });
  });

  describe("Basic Auth", function() {
    it("should have valid authorization header if username and password is set in options", function(done) {
      let mockServer;
      return mockServer = testUtils.createMockServer(201, "Mock response body\n", 9875, (function() {
        // Setup a channel for the mock endpoint
        let channel = {
          name: "Mock endpoint",
          urlPattern: ".+",
          routes: [{
                host: "localhost",
                port: 9875,
                primary: true,
                username: "username",
                password: "password"
              }
              ]
        };

        let ctx = new Object();
        ctx.authorisedChannel = channel;
        ctx.request = new Object();
        ctx.response = new Object();
        ctx.response.set = function() {};
        ctx.request.url = "/test";
        ctx.request.method = "GET";
        ctx.requestTimestamp = requestTimestamp;

        return router.route(ctx, function(err) {
          if (err) {
            return done(err);
          }
      });
      }), function(req, res) {
        // Base64("username:password") = "dXNlcm5hbWU6cGFzc3dvcmQ=""
        req.headers.authorization.should.be.exactly("Basic dXNlcm5hbWU6cGFzc3dvcmQ=");
        return mockServer.close(done);
      });
    });

    it("should not have authorization header if username and password is absent from options", function(done) {
      let mockServer;
      return mockServer = testUtils.createMockServer(201, "Mock response body\n", 9874, (function() {
        // Setup a channel for the mock endpoint
        let channel = {
          name: "Mock endpoint",
          urlPattern: ".+",
          routes: [{
                host: "localhost",
                port: 9874,
                primary: true
              }
              ]
        };
        let ctx = new Object();
        ctx.authorisedChannel = channel;
        ctx.request = new Object();
        ctx.response = new Object();
        ctx.response.set = function() {};
        ctx.request.url = "/test";
        ctx.request.method = "GET";
        ctx.requestTimestamp = requestTimestamp;

        return router.route(ctx, function(err) {
          if (err) {
            return done(err);
          }
      });
      }), function(req, res) {
        (req.headers.authorization === undefined).should.be.true;
        return mockServer.close(done);
      });
    });

    it("should not propagate the authorization header present in the request headers", function(done) {
      let mockServer;
      return mockServer = testUtils.createMockServer(201, "Mock response body\n", 9872, (function() {
        // Setup a channel for the mock endpoint
        let channel = {
          name: "Mock endpoint",
          urlPattern: ".+",
          routes: [{
                host: "localhost",
                port: 9872,
                primary: true
              }
              ]
        };
        let ctx = new Object();
        ctx.authorisedChannel = channel;
        ctx.request = new Object();
        ctx.response = new Object();
        ctx.response.set = function() {};
        ctx.request.url = "/test";
        ctx.request.method = "GET";
        ctx.request.header = { authorization: "Basic bWU6bWU=" };
        ctx.requestTimestamp = requestTimestamp;

        return router.route(ctx, function(err) {
          if (err) {
            return done(err);
          }
      });
      }), function(req, res) {
        (req.headers.authorization === undefined).should.be.true;
        return mockServer.close(done);
      });
    });

    it("should propagate the authorization header present in the request headers if forwardAuthHeader is set to true", function(done) {
      let mockServer;
      return mockServer = testUtils.createMockServer(201, "Mock response body\n", 9872, (function() {
        // Setup a channel for the mock endpoint
        let channel = {
          name: "Mock endpoint",
          urlPattern: ".+",
          routes: [{
                host: "localhost",
                port: 9872,
                primary: true,
                forwardAuthHeader: true
              }
              ]
        };
        let ctx = new Object();
        ctx.authorisedChannel = channel;
        ctx.request = new Object();
        ctx.response = new Object();
        ctx.response.set = function() {};
        ctx.request.url = "/test";
        ctx.request.method = "GET";
        ctx.request.header = { authorization: "Basic bWU6bWU=" };
        ctx.requestTimestamp = requestTimestamp;

        return router.route(ctx, function(err) {
          if (err) {
            return done(err);
          }
      });
      }), function(req, res) {
        req.headers.authorization.should.be.exactly("Basic bWU6bWU=");
        return mockServer.close(done);
      });
    });

    return it("should not propagate the authorization header present in the request headers and must set the correct header if enabled on route", done =>
      testUtils.createMockServer(201, "Mock response body\n", 9871, (function() {
        // Setup a channel for the mock endpoint
        let channel = {
          name: "Mock endpoint",
          urlPattern: ".+",
          routes: [{
                host: "localhost",
                port: 9871,
                primary: true,
                username: "username",
                password: "password"
              }
              ]
        };

        let ctx = new Object();
        ctx.authorisedChannel = channel;
        ctx.request = new Object();
        ctx.response = new Object();
        ctx.response.set = function() {};
        ctx.request.url = "/test";
        ctx.request.method = "GET";
        ctx.request.header = { authorization: "Basic bWU6bWU=" };
        ctx.requestTimestamp = requestTimestamp;

        return router.route(ctx, function(err) {
          if (err) {
            return done(err);
          }
      });
      }), function(req, res) {
        // Base64("username:password") = "dXNlcm5hbWU6cGFzc3dvcmQ=""
        req.headers.authorization.should.be.exactly("Basic dXNlcm5hbWU6cGFzc3dvcmQ=");
        return done();
      })
    );
  });

  describe("Path Redirection", function() {
    describe(".transformPath", () =>
      it("must transform the path string correctly", function(done) {
        let test = (path, expr, res) => router.transformPath(path, expr).should.be.exactly(res);
        test("foo", "s/foo/bar", "bar");
        test("foo", "s/foo/", "");
        test("foo", "s/o/e/g", "fee");
        test("foofoo", "s/foo//g", "");
        test("foofoofoo", "s/foo/bar", "barfoofoo");
        test("foofoofoo", "s/foo/bar/g", "barbarbar");
        test("foo/bar", "s/foo/bar", "bar/bar");
        test("foo/bar", "s/foo\\\/bar/", "");
        test("foo/foo/bar/bar", "s/\\\/foo\\\/bar/", "foo/bar");
        test("prefix/foo/bar", "s/prefix\\\//", "foo/bar");
        return done();
      })
    );

    let testPathRedirectionRouting = function(mockServerPort, channel, expectedTargetPath, callback) {
      let setup = function() {
        let ctx = new Object();
        ctx.authorisedChannel = channel;
        ctx.request = new Object();
        ctx.response = new Object();
        ctx.response.set = function() {};
        ctx.path = (ctx.request.url = "/test");
        ctx.request.method = "GET";
        ctx.requestTimestamp = requestTimestamp;

        return router.route(ctx, function(err) {
          if (err) {
            return done(err);
          }

          ctx.response.status.should.be.exactly(200);
          ctx.response.body.toString().should.be.eql("Mock response body\n");
          return ctx.response.header.should.be.ok;
        });
      };

      return testUtils.createMockServer(200, "Mock response body\n", mockServerPort, setup, function(req, res) {
        req.url.should.be.exactly(expectedTargetPath);
        return callback();
      });
    };

    it("should redirect the request to a specific path", function(done) {
      let channel = {
        name: "Path test",
        urlPattern: ".+",
        routes: [{
              host: "localhost",
              port: 9886,
              path: "/target",
              primary: true
            }
            ]
      };
      return testPathRedirectionRouting(9886, channel, "/target", done);
    });

    return it("should redirect the request to the transformed path", function(done) {
      let channel = {
        name: "Path test",
        urlPattern: ".+",
        routes: [{
              host: "localhost",
              port: 9887,
              pathTransform: "s/test/target",
              primary: true
            }
            ]
      };
      return testPathRedirectionRouting(9887, channel, "/target", done);
    });
  });

  return describe('setKoaResponse', function() {

    let createCtx = function() {
      let ctx = {};
      ctx.response = {};
      ctx.response.set = sinon.spy();
      return ctx;
    };

    let createResponse = function() {
      let response;
      return response = {
        status: 201,
        headers: {
          'content-type': 'text/xml',
          'x-header': 'anotherValue'
        },
        timestamp: new Date(),
        body: 'Mock response body'
      };
    };

    it('should set the ctx.response object', function() {
      // given
      let ctx = createCtx();
      let response = createResponse();

      // when
      router.setKoaResponse(ctx, response);

      // then
      ctx.response.status.should.be.exactly(response.status);
      ctx.response.body.should.be.exactly(response.body);
      return ctx.response.timestamp.should.be.exactly(response.timestamp);
    });

    it('should copy response headers to the ctx.response object', function() {
      // given
      let ctx = createCtx();
      let response = createResponse();

      // when
      router.setKoaResponse(ctx, response);

      // then
      return (ctx.response.set.calledWith('x-header', 'anotherValue')).should.be.true;
    });

    it('should redirect the context if needed', function() {
      // given
      let ctx = createCtx();
      ctx.response.redirect = sinon.spy();

      let response = {
        status: 301,
        headers: {
          'content-type': 'text/xml',
          'x-header': 'anotherValue',
          'location': 'http://some.other.place.org'
        },
        timestamp: new Date(),
        body: 'Mock response body'
      };

      // when
      router.setKoaResponse(ctx, response);

      // then
      return (ctx.response.redirect.calledWith('http://some.other.place.org')).should.be.true;
    });

    return it('should not redirect if a non-redirect status is recieved', function() {
      // given
      let ctx = createCtx();
      ctx.response.redirect = sinon.spy();

      let response = {
        status: 201,
        headers: {
          'content-type': 'text/xml',
          'x-header': 'anotherValue',
          'location': 'http://some.other.place.org'
        },
        timestamp: new Date(),
        body: 'Mock response body'
      };

      // when
      router.setKoaResponse(ctx, response);

      // then
      return (ctx.response.redirect.calledWith('http://some.other.place.org')).should.be.false;
    });
  });
});
