/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import should from "should";
import request from "supertest";
import * as server from "../../src/server";
import { Channel } from "../../src/model/channels";
import { Mediator } from "../../src/model/mediators";
import * as testUtils from "../testUtils";

const { auth } = testUtils;

describe("API Integration Tests", () =>
    describe("Mediators REST API testing", () => {
      const mediator1 = {
        urn: "urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED",
        version: "1.0.0",
        name: "Save Encounter Mediator",
        description: "A mediator for testing",
        endpoints: [
          {
            name: "Save Encounter",
            host: "localhost",
            port: "8005",
            type: "http"
          }
        ],
        defaultChannelConfig: [{
          name: "Save Encounter 1",
          urlPattern: "/encounters",
          type: "http",
          allow: [],
          routes: [
            {
              name: "Save Encounter 1",
              host: "localhost",
              port: "8005",
              type: "http"
            }
          ]
        },
        {
          name: "Save Encounter 2",
          urlPattern: "/encounters2",
          type: "http",
          allow: [],
          routes: [
            {
              name: "Save Encounter 2",
              host: "localhost",
              port: "8005",
              type: "http"
            }
          ]
        }
        ]
      };

      const mediator2 = {
        urn: "urn:uuid:25ABAB99-23BF-4AAB-8832-7E07E4EA5902",
        version: "0.8.2",
        name: "Patient Mediator",
        description: "Another mediator for testing",
        endpoints: [
          {
            name: "Patient",
            host: "localhost",
            port: "8006",
            type: "http"
          }
        ]
      };

      const mediator3 = {
        urn: "urn:mediator:no-default-channel-conf",
        version: "1.0.0",
        name: "Mediator without default channel conf",
        description: "Another mediator for testing",
        endpoints: [
          {
            name: "Route",
            host: "localhost",
            port: "8009",
            type: "http"
          }
        ]
      };

      let authDetails = {};

      before(done =>
            auth.setupTestUsers((err) => {
              if (err) { return done(err); }
              return Channel.ensureIndexes(() =>
                    Mediator.ensureIndexes(() => server.start({ apiPort: 8080 }, done))
                );
            })
        );

      after(done => server.stop(() => auth.cleanupTestUsers(done)));

      beforeEach(() => authDetails = auth.getAuthDetails());

      afterEach(done => Mediator.remove({}, () => Channel.remove({}, done)));

      describe("*getAllMediators()", () => {
        it("should fetch all mediators", done =>
                new Mediator(mediator1).save(() =>
                    new Mediator(mediator2).save(() =>
                        request("https://localhost:8080")
                            .get("/mediators")
                            .set("auth-username", testUtils.rootUser.email)
                            .set("auth-ts", authDetails.authTS)
                            .set("auth-salt", authDetails.authSalt)
                            .set("auth-token", authDetails.authToken)
                            .expect(200)
                            .end((err, res) => {
                              if (err) {
                                return done(err);
                              } else {
                                res.body.length.should.be.eql(2);
                                return done();
                              }
                            })
                    )
                )
            );

        return it("should not allow non root user to fetch mediators", done =>
                request("https://localhost:8080")
                    .get("/mediators")
                    .set("auth-username", testUtils.nonRootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .expect(403)
                    .end((err, res) => {
                      if (err) {
                        return done(err);
                      } else {
                        return done();
                      }
                    })
            );
      });

      describe("*getMediator()", () => {
        it("should fetch mediator", done =>
                new Mediator(mediator1).save(() =>
                    request("https://localhost:8080")
                        .get(`/mediators/${mediator1.urn}`)
                        .set("auth-username", testUtils.rootUser.email)
                        .set("auth-ts", authDetails.authTS)
                        .set("auth-salt", authDetails.authSalt)
                        .set("auth-token", authDetails.authToken)
                        .expect(200)
                        .end((err, res) => {
                          if (err) {
                            return done(err);
                          } else {
                            res.body.urn.should.be.exactly(mediator1.urn);
                            return done();
                          }
                        })
                )
            );

        it("should return status 404 if not found", done =>
                request("https://localhost:8080")
                    .get(`/mediators/${mediator1.urn}`)
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .expect(404)
                    .end((err, res) => {
                      if (err) {
                        return done(err);
                      } else {
                        return done();
                      }
                    })
            );

        return it("should not allow non root user to fetch mediator", done =>
                request("https://localhost:8080")
                    .get(`/mediators/${mediator1.urn}`)
                    .set("auth-username", testUtils.nonRootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .expect(403)
                    .end((err, res) => {
                      if (err) {
                        return done(err);
                      } else {
                        return done();
                      }
                    })
            );
      });

      describe("*addMediator()", () => {
        it("should return 201", done =>
                request("https://localhost:8080")
                    .post("/mediators")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(mediator1)
                    .expect(201)
                    .end((err, res) => {
                      if (err) {
                        return done(err);
                      } else {
                        return done();
                      }
                    })
            );

        it("should not allow non root user to add mediator", done =>
                request("https://localhost:8080")
                    .post("/mediators")
                    .set("auth-username", testUtils.nonRootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(mediator1)
                    .expect(403)
                    .end((err, res) => {
                      if (err) {
                        return done(err);
                      } else {
                        return done();
                      }
                    })
            );

        it("should add the mediator to the mediators collection", done =>
                request("https://localhost:8080")
                    .post("/mediators")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(mediator1)
                    .expect(201)
                    .end((err, res) => {
                      if (err) {
                        return done(err);
                      } else {
                        return Mediator.findOne({ urn: mediator1.urn }, (err, res) => {
                          if (err) { return done(err); }
                          should.exist(res);
                          return done();
                        });
                      }
                    })
            );

        it("should add multiple mediators without default channel config", done =>
                request("https://localhost:8080")
                    .post("/mediators")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(mediator2)
                    .expect(201)
                    .end((err, res) => {
                      if (err) { return done(err); }
                      return request("https://localhost:8080")
                            .post("/mediators")
                            .set("auth-username", testUtils.rootUser.email)
                            .set("auth-ts", authDetails.authTS)
                            .set("auth-salt", authDetails.authSalt)
                            .set("auth-token", authDetails.authToken)
                            .send(mediator3)
                            .expect(201)
                            .end((err, res) => {
                              if (err) { return done(err); }
                              return done();
                            });
                    })
            );

        it("should not do anything if the mediator already exists and the version number is equal", (done) => {
          const updatedMediator = {
            urn: "urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED",
            version: "1.0.0",
            name: "Updated Encounter Mediator"
          };
          return new Mediator(mediator1).save(() =>
                    request("https://localhost:8080")
                        .post("/mediators")
                        .set("auth-username", testUtils.rootUser.email)
                        .set("auth-ts", authDetails.authTS)
                        .set("auth-salt", authDetails.authSalt)
                        .set("auth-token", authDetails.authToken)
                        .send(updatedMediator)
                        .expect(201)
                        .end((err, res) => {
                          if (err) {
                            return done(err);
                          } else {
                            return Mediator.find({ urn: mediator1.urn }, (err, res) => {
                              if (err) { return done(err); }
                              res.length.should.be.exactly(1);
                              res[0].name.should.be.exactly(mediator1.name);
                              return done();
                            });
                          }
                        })
                );
        });

        it("should not do anything if the mediator already exists and the version number is less-than", (done) => {
          const updatedMediator = {
            urn: "urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED",
            version: "0.9.5",
            name: "Updated Encounter Mediator"
          };
          return new Mediator(mediator1).save(() =>
                    request("https://localhost:8080")
                        .post("/mediators")
                        .set("auth-username", testUtils.rootUser.email)
                        .set("auth-ts", authDetails.authTS)
                        .set("auth-salt", authDetails.authSalt)
                        .set("auth-token", authDetails.authToken)
                        .send(updatedMediator)
                        .expect(201)
                        .end((err, res) => {
                          if (err) {
                            return done(err);
                          } else {
                            return Mediator.find({ urn: mediator1.urn }, (err, res) => {
                              if (err) { return done(err); }
                              res.length.should.be.exactly(1);
                              res[0].name.should.be.exactly(mediator1.name);
                              return done();
                            });
                          }
                        })
                );
        });

        it("should update the mediator if the mediator already exists and the version number is greater-than", (done) => {
          const updatedMediator = {
            urn: "urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED",
            version: "1.0.1",
            name: "Updated Encounter Mediator"
          };
          return new Mediator(mediator1).save(() =>
                    request("https://localhost:8080")
                        .post("/mediators")
                        .set("auth-username", testUtils.rootUser.email)
                        .set("auth-ts", authDetails.authTS)
                        .set("auth-salt", authDetails.authSalt)
                        .set("auth-token", authDetails.authToken)
                        .send(updatedMediator)
                        .expect(201)
                        .end((err, res) => {
                          if (err) {
                            return done(err);
                          } else {
                            return Mediator.find({ urn: mediator1.urn }, (err, res) => {
                              if (err) { return done(err); }
                              res.length.should.be.exactly(1);
                              res[0].name.should.be.exactly(updatedMediator.name);
                              return done();
                            });
                          }
                        })
                );
        });

        it("should not update config that has already been set", (done) => {
          const mediator = {
            urn: "urn:uuid:66237a48-2e76-4318-8cd6-9c6649ad6f5f",
            name: "Mediator",
            version: "0.8.0",
            description: "Invalid mediator for testing",
            endpoints: [{
              name: "Patient",
              host: "localhost",
              port: "8006",
              type: "http"
            }
            ],
            configDefs: [{
              param: "param1",
              type: "string"
            },
            {
              param: "param2",
              type: "number"
            }
            ],
            config: {
              param1: "val1",
              param2: 5
            }
          };
          const updatedMediator = {
            urn: "urn:uuid:66237a48-2e76-4318-8cd6-9c6649ad6f5f",
            version: "1.0.1",
            name: "Updated Mediator",
            configDefs: [{
              param: "param1",
              type: "string"
            },
            {
              param: "param2",
              type: "number"
            },
            {
              param: "param3",
              type: "bool"
            }
            ],
            config: {
              param1: "val1",
              param2: 6,
              param3: true
            }
          };
          return new Mediator(mediator).save(() =>
                    request("https://localhost:8080")
                        .post("/mediators")
                        .set("auth-username", testUtils.rootUser.email)
                        .set("auth-ts", authDetails.authTS)
                        .set("auth-salt", authDetails.authSalt)
                        .set("auth-token", authDetails.authToken)
                        .send(updatedMediator)
                        .expect(201)
                        .end((err, res) => {
                          if (err) {
                            return done(err);
                          } else {
                            return Mediator.find({ urn: mediator.urn }, (err, res) => {
                              if (err) { return done(err); }
                              res.length.should.be.exactly(1);
                              res[0].name.should.be.exactly(updatedMediator.name);
                              res[0].config.param2.should.be.exactly(5); // unchanged
                              res[0].config.param3.should.be.exactly(true); // new
                              return done();
                            });
                          }
                        })
                );
        });

        it("should reject mediators without a UUID", (done) => {
          const invalidMediator = {
            version: "0.8.2",
            name: "Patient Mediator",
            description: "Invalid mediator for testing",
            endpoints: [
              {
                name: "Patient",
                host: "localhost",
                port: "8006",
                type: "http"
              }
            ]
          };
          return request("https://localhost:8080")
                    .post("/mediators")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(invalidMediator)
                    .expect(400)
                    .end((err, res) => {
                      if (err) {
                        return done(err);
                      } else {
                        return done();
                      }
                    });
        });

        it("should reject mediators without a name", (done) => {
          const invalidMediator = {
            urn: "urn:uuid:CA5B32BC-87CB-46A5-B9C7-AAF03500989A",
            version: "0.8.2",
            description: "Invalid mediator for testing",
            endpoints: [
              {
                name: "Patient",
                host: "localhost",
                port: "8006",
                type: "http"
              }
            ]
          };
          return request("https://localhost:8080")
                    .post("/mediators")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(invalidMediator)
                    .expect(400)
                    .end((err, res) => {
                      if (err) {
                        return done(err);
                      } else {
                        return done();
                      }
                    });
        });

        it("should reject mediators without a version number", (done) => {
          const invalidMediator = {
            urn: "urn:uuid:CA5B32BC-87CB-46A5-B9C7-AAF03500989A",
            name: "Patient Mediator",
            description: "Invalid mediator for testing",
            endpoints: [
              {
                name: "Patient",
                host: "localhost",
                port: "8006",
                type: "http"
              }
            ]
          };
          return request("https://localhost:8080")
                    .post("/mediators")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(invalidMediator)
                    .expect(400)
                    .end((err, res) => {
                      if (err) {
                        return done(err);
                      } else {
                        return done();
                      }
                    });
        });

        it("should reject mediators with an invalid SemVer version number (x.y.z)", (done) => {
          const invalidMediator = {
            urn: "urn:uuid:CA5B32BC-87CB-46A5-B9C7-AAF03500989A",
            name: "Patient Mediator",
            version: "0.8",
            description: "Invalid mediator for testing",
            endpoints: [
              {
                name: "Patient",
                host: "localhost",
                port: "8006",
                type: "http"
              }
            ]
          };
          return request("https://localhost:8080")
                    .post("/mediators")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(invalidMediator)
                    .expect(400)
                    .end((err, res) => {
                      if (err) {
                        return done(err);
                      } else {
                        return done();
                      }
                    });
        });

        it("should reject mediators with no endpoints specified", (done) => {
          const invalidMediator = {
            urn: "urn:uuid:CA5B32BC-87CB-46A5-B9C7-AAF03500989A",
            name: "Patient Mediator",
            version: "0.8.2",
            description: "Invalid mediator for testing"
          };
          return request("https://localhost:8080")
                    .post("/mediators")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(invalidMediator)
                    .expect(400)
                    .end((err, res) => {
                      if (err) {
                        return done(err);
                      } else {
                        return done();
                      }
                    });
        });

        it("should reject mediators with an empty endpoints array specified", (done) => {
          const invalidMediator = {
            urn: "urn:uuid:CA5B32BC-87CB-46A5-B9C7-AAF03500989A",
            name: "Patient Mediator",
            version: "0.8.2",
            description: "Invalid mediator for testing",
            endpoints: []
          };
          return request("https://localhost:8080")
                    .post("/mediators")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(invalidMediator)
                    .expect(400)
                    .end((err, res) => {
                      if (err) {
                        return done(err);
                      } else {
                        return done();
                      }
                    });
        });

        it("should reject mediators with invalid default config", (done) => {
          const invalidMediator = {
            urn: "urn:uuid:CA5B32BC-87CB-46A5-B9C7-AAF03500989A",
            name: "Patient Mediator",
            version: "0.8.0",
            description: "Invalid mediator for testing",
            endpoints: [{
              name: "Patient",
              host: "localhost",
              port: "8006",
              type: "http"
            }
            ],
            configDefs: [{
              param: "param1",
              type: "string"
            },
            {
              param: "param2",
              type: "number"
            }
            ],
            config: {
              param1: "val1",
              param2: "val2"
            }
          };
          return request("https://localhost:8080")
                    .post("/mediators")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(invalidMediator)
                    .expect(400)
                    .end((err, res) => {
                      if (err) {
                        return done(err);
                      } else {
                        return done();
                      }
                    });
        });

        it("should store mediator config and config definitions", (done) => {
          const validMediator = {
            urn: "urn:uuid:35a7e5e6-acbb-497d-8b01-259fdcc0d5c2",
            name: "Patient Mediator",
            version: "0.8.0",
            description: "Invalid mediator for testing",
            endpoints: [{
              name: "Patient",
              host: "localhost",
              port: "8006",
              type: "http"
            }
            ],
            configDefs: [{
              param: "param1",
              type: "string"
            },
            {
              param: "param2",
              type: "number"
            }
            ],
            config: {
              param1: "val1",
              param2: 5
            }
          };
          return request("https://localhost:8080")
                    .post("/mediators")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(validMediator)
                    .expect(201)
                    .end((err, res) => {
                      if (err) {
                        return done(err);
                      } else {
                        return Mediator.findOne({ urn: validMediator.urn }, (err, mediator) => {
                          mediator.config.should.deepEqual(validMediator.config);
                          mediator.configDefs.should.have.length(2);
                          return done();
                        });
                      }
                    });
        });

        it("should reject a mediator if the config definition does not contain a template for a struct", (done) => {
          const mediator = {
            urn: "urn:mediator:structmediator-1",
            name: "structmediator-1",
            version: "0.8.0",
            description: "Invalid mediator for testing",
            endpoints: [{
              name: "Patient",
              host: "localhost",
              port: "8006",
              type: "http"
            }
            ],
            configDefs: [{
              param: "param1",
              displayName: "Parameter 1",
              description: "Test config",
              type: "struct"
            }
            ]
          };
          return request("https://localhost:8080")
                    .post("/mediators")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(mediator)
                    .expect(400)
                    .end((err, res) => {
                      if (err) {
                        return done(err);
                      } else {
                        return done();
                      }
                    });
        });

        it("should reject a mediator if the config definition contains an invalid template for a struct", (done) => {
          const mediator = {
            urn: "urn:mediator:structmediator-2",
            name: "structmediator-2",
            version: "0.8.0",
            description: "Invalid mediator for testing",
            endpoints: [{
              name: "Patient",
              host: "localhost",
              port: "8006",
              type: "http"
            }
            ],
            configDefs: [{
              param: "param1",
              displayName: "Parameter 1",
              description: "Test config",
              type: "struct",
              template: [
                            { field: "this is not a valid template" }
              ]
            }
            ]
          };
          return request("https://localhost:8080")
                    .post("/mediators")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(mediator)
                    .expect(400)
                    .end((err, res) => {
                      if (err) {
                        return done(err);
                      } else {
                        return done();
                      }
                    });
        });

        it("should store a mediator with config and a config definition that contains a valid struct", (done) => {
          const mediator = {
            urn: "urn:mediator:structmediator-3",
            name: "structmediator-3",
            version: "0.8.0",
            description: "Invalid mediator for testing",
            endpoints: [{
              name: "Patient",
              host: "localhost",
              port: "8006",
              type: "http"
            }
            ],
            configDefs: [{
              param: "param1",
              displayName: "Parameter 1",
              description: "Test config",
              type: "struct",
              template: [
                {
                  param: "server",
                  displayName: "Server",
                  description: "Server",
                  type: "string"
                }, {
                  param: "port",
                  displayName: "Port",
                  description: "Port",
                  type: "number"
                }, {
                  param: "secure",
                  type: "bool"
                }, {
                  param: "pickAorB",
                  type: "option",
                  values: ["A", "B"]
                }
              ]
            }
            ],
            config: {
              param1: {
                server: "localhost",
                port: 8080,
                secure: false,
                pickAorB: "A"
              }
            }
          };
          return request("https://localhost:8080")
                    .post("/mediators")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(mediator)
                    .expect(201)
                    .end((err, res) => {
                      if (err) {
                        return done(err);
                      } else {
                        return done();
                      }
                    });
        });

        it("should reject a mediator if the config definition does not contain a 'values' array for an option", (done) => {
          const mediator = {
            urn: "urn:mediator:optionmediator-1",
            name: "optionmediator-1",
            version: "0.8.0",
            description: "Invalid mediator for testing",
            endpoints: [{
              name: "Patient",
              host: "localhost",
              port: "8006",
              type: "http"
            }
            ],
            configDefs: [{
              param: "param1",
              displayName: "Parameter 1",
              description: "Test config",
              type: "option"
            }
            ]
          };
          return request("https://localhost:8080")
                    .post("/mediators")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(mediator)
                    .expect(400)
                    .end((err, res) => {
                      if (err) {
                        return done(err);
                      } else {
                        return done();
                      }
                    });
        });

        it("should reject a mediator if the config definition contains an empty 'values' array for an option", (done) => {
          const mediator = {
            urn: "urn:mediator:optionmediator-2",
            name: "optionmediator-2",
            version: "0.8.0",
            description: "Invalid mediator for testing",
            endpoints: [{
              name: "Patient",
              host: "localhost",
              port: "8006",
              type: "http"
            }
            ],
            configDefs: [{
              param: "param1",
              displayName: "Parameter 1",
              description: "Test config",
              type: "option",
              values: []
            }
            ]
          };
          return request("https://localhost:8080")
                    .post("/mediators")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(mediator)
                    .expect(400)
                    .end((err, res) => {
                      if (err) {
                        return done(err);
                      } else {
                        return done();
                      }
                    });
        });

        return it("should reject a mediator if the config definition contains a non-array 'values' field for an option", (done) => {
          const mediator = {
            urn: "urn:mediator:optionmediator-3",
            name: "optionmediator-3",
            version: "0.8.0",
            description: "Invalid mediator for testing",
            endpoints: [{
              name: "Patient",
              host: "localhost",
              port: "8006",
              type: "http"
            }
            ],
            configDefs: [{
              param: "param1",
              displayName: "Parameter 1",
              description: "Test config",
              type: "option",
              values: "this is not an array"
            }
            ]
          };
          return request("https://localhost:8080")
                    .post("/mediators")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send(mediator)
                    .expect(400)
                    .end((err, res) => {
                      if (err) {
                        return done(err);
                      } else {
                        return done();
                      }
                    });
        });
      });

      describe("*removeMediator", () => {
        it("should remove an mediator with specified urn", (done) => {
          const mediatorDelete = {
            urn: "urn:uuid:EEA84E13-2M74-467C-UD7F-7C480462D1DF",
            version: "1.0.0",
            name: "Test Mediator",
            description: "A mediator for testing",
            endpoints: [
              {
                name: "Save Encounter",
                host: "localhost",
                port: "6000",
                type: "http"
              }
            ],
            defaultChannelConfig: [{
              name: "Test Mediator",
              urlPattern: "/test",
              type: "http",
              allow: [],
              routes: [
                {
                  name: "Test Route",
                  host: "localhost",
                  port: "9000",
                  type: "http"
                }
              ]
            }
            ]
          };

          const mediator = new Mediator(mediatorDelete);
          return mediator.save((error, mediator) => {
            should.not.exist(error);
            return Mediator.count((err, countBefore) =>
                        request("https://localhost:8080")
                            .del(`/mediators/${mediator.urn}`)
                            .set("auth-username", testUtils.rootUser.email)
                            .set("auth-ts", authDetails.authTS)
                            .set("auth-salt", authDetails.authSalt)
                            .set("auth-token", authDetails.authToken)
                            .expect(200)
                            .end((err, res) => {
                              if (err) {
                                return done(err);
                              } else {
                                return Mediator.count((err, countAfter) =>
                                        Mediator.findOne({ urn: mediator.urn }, (error, notFoundDoc) => {
                                          (notFoundDoc === null).should.be.true;
                                          (countBefore - 1).should.equal(countAfter);
                                          return done();
                                        })
                                    );
                              }
                            })
                    );
          });
        });

        return it("should not allow a non admin user to remove a mediator", done =>

                request("https://localhost:8080")
                    .del("/mediators/urn:uuid:EEA84E13-2M74-467C-UD7F-7C480462D1DF")
                    .set("auth-username", testUtils.nonRootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .expect(403)
                    .end((err, res) => {
                      if (err) {
                        return done(err);
                      } else {
                        return done();
                      }
                    })
            );
      });

      describe("*heartbeat()", () => {
        it("should store uptime and lastHeartbeat then return a 200 status", done =>
                new Mediator(mediator1).save(() =>
                    request("https://localhost:8080")
                        .post("/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/heartbeat")
                        .set("auth-username", testUtils.rootUser.email)
                        .set("auth-ts", authDetails.authTS)
                        .set("auth-salt", authDetails.authSalt)
                        .set("auth-token", authDetails.authToken)
                        .send({
                          uptime: 50.25
                        })
                        .expect(200)
                        .end((err, res) => {
                          if (err) {
                            return done(err);
                          } else {
                            return Mediator.findOne({ urn: mediator1.urn }, (err, mediator) => {
                              if (err) {
                                return done(err);
                              }
                              mediator._uptime.should.be.exactly(50.25);
                              should.exist(mediator._lastHeartbeat);
                              res.body.should.be.empty();
                              return done();
                            });
                          }
                        })
                )
            );

        it("should return config if the config was updated since the last heartbeat", done =>
                new Mediator(mediator1).save(() => {
                  const now = new Date();
                  const prev = new Date();
                  const update = {
                    config: {
                      param1: "val1",
                      param2: "val2"
                    },
                    _configModifiedTS: now,
                    _lastHeartbeat: new Date(prev.setMinutes(now.getMinutes() - 5))
                  };
                  return Mediator.findOneAndUpdate({ urn: mediator1.urn }, update, err =>
                        request("https://localhost:8080")
                            .post("/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/heartbeat")
                            .set("auth-username", testUtils.rootUser.email)
                            .set("auth-ts", authDetails.authTS)
                            .set("auth-salt", authDetails.authSalt)
                            .set("auth-token", authDetails.authToken)
                            .send({
                              uptime: 50.25
                            })
                            .expect(200)
                            .end((err, res) => {
                              if (err) {
                                return done(err);
                              } else {
                                res.body.param1.should.be.exactly("val1");
                                res.body.param2.should.be.exactly("val2");
                                return done();
                              }
                            })
                    );
                })
            );

        it("should return the latest config if the config property in the request is true", done =>
                new Mediator(mediator1).save(() => {
                  const now = new Date();
                  const update = {
                    config: {
                      param1: "val1",
                      param2: "val2"
                    },
                    _configModifiedTS: now,
                    _lastHeartbeat: now
                  };
                  return Mediator.findOneAndUpdate({ urn: mediator1.urn }, update, err =>
                        request("https://localhost:8080")
                            .post("/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/heartbeat")
                            .set("auth-username", testUtils.rootUser.email)
                            .set("auth-ts", authDetails.authTS)
                            .set("auth-salt", authDetails.authSalt)
                            .set("auth-token", authDetails.authToken)
                            .send({
                              uptime: 50.25,
                              config: true
                            })
                            .expect(200)
                            .end((err, res) => {
                              if (err) {
                                return done(err);
                              } else {
                                res.body.param1.should.be.exactly("val1");
                                res.body.param2.should.be.exactly("val2");
                                return done();
                              }
                            })
                    );
                })
            );

        it("should deny access to a non admin user", done =>
                request("https://localhost:8080")
                    .post("/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/heartbeat")
                    .set("auth-username", testUtils.nonRootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send({
                      uptime: 50.25
                    })
                    .expect(403)
                    .end((err, res) => {
                      if (err) {
                        return done(err);
                      } else {
                        return done();
                      }
                    })
            );

        it("should return a 404 if the mediator specified by urn cannot be found", done =>
                request("https://localhost:8080")
                    .post("/mediators/urn:uuid:this-doesnt-exist/heartbeat")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send({
                      uptime: 50.25
                    })
                    .expect(404)
                    .end((err, res) => {
                      if (err) {
                        return done(err);
                      } else {
                        return done();
                      }
                    })
            );

        return it("should return a 400 if an invalid body is received", done =>
                new Mediator(mediator1).save(() =>
                    request("https://localhost:8080")
                        .post("/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/heartbeat")
                        .set("auth-username", testUtils.rootUser.email)
                        .set("auth-ts", authDetails.authTS)
                        .set("auth-salt", authDetails.authSalt)
                        .set("auth-token", authDetails.authToken)
                        .send({
                          downtime: 0.5
                        })
                        .expect(400)
                        .end((err, res) => {
                          if (err) {
                            return done(err);
                          } else {
                            return done();
                          }
                        })
                )
            );
      });

      describe("*setConfig()", () => {
        it("should deny access to a non admin user", done =>
                request("https://localhost:8080")
                    .put("/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/config")
                    .set("auth-username", testUtils.nonRootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send({
                      param1: "val1",
                      param2: "val2"
                    })
                    .expect(403)
                    .end((err, res) => {
                      if (err) {
                        return done(err);
                      } else {
                        return done();
                      }
                    })
            );

        it("should return a 404 if the mediator specified by urn cannot be found", done =>
                request("https://localhost:8080")
                    .put("/mediators/urn:uuid:this-doesnt-exist/config")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send({
                      param1: "val1",
                      param2: "val2"
                    })
                    .expect(404)
                    .end((err, res) => {
                      if (err) {
                        return done(err);
                      } else {
                        return done();
                      }
                    })
            );

        it("should set the current config for a mediator and return a 200 status", (done) => {
          mediator1.configDefs =
          [{
            param: "param1",
            type: "string"
          },
          {
            param: "param2",
            type: "string"
          }
          ];
          return new Mediator(mediator1).save(() =>
                    request("https://localhost:8080")
                        .put("/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/config")
                        .set("auth-username", testUtils.rootUser.email)
                        .set("auth-ts", authDetails.authTS)
                        .set("auth-salt", authDetails.authSalt)
                        .set("auth-token", authDetails.authToken)
                        .send({
                          param1: "val1",
                          param2: "val2"
                        })
                        .expect(200)
                        .end((err, res) => {
                          if (err) {
                            return done(err);
                          } else {
                            return Mediator.findOne({ urn: mediator1.urn }, (err, mediator) => {
                              if (err) {
                                return done(err);
                              }
                              mediator.config.param1.should.be.exactly("val1");
                              mediator.config.param2.should.be.exactly("val2");
                              should.exist(mediator._configModifiedTS);
                              return done();
                            });
                          }
                        })
                );
        });

        return it("should return a 400 if the config object contains unknown keys", (done) => {
          mediator1.configDefs =
          [{
            param: "param1",
            type: "string"
          },
          {
            param: "param2",
            type: "string"
          }
          ];
          return new Mediator(mediator1).save(() =>
                    request("https://localhost:8080")
                        .put("/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/config")
                        .set("auth-username", testUtils.rootUser.email)
                        .set("auth-ts", authDetails.authTS)
                        .set("auth-salt", authDetails.authSalt)
                        .set("auth-token", authDetails.authToken)
                        .send({
                          param1: "val1",
                          param2: "val2",
                          badParam: "val3"
                        })
                        .expect(400)
                        .end((err, res) => {
                          if (err) {
                            return done(err);
                          } else {
                            return done();
                          }
                        })
                );
        });
      });

      return describe("*loadDefaultChannels()", () => {
        it("should deny access to non-admin users", done =>
                request("https://localhost:8080")
                    .post("/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/channels")
                    .set("auth-username", testUtils.nonRootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send([])
                    .expect(403)
                    .end((err, res) => {
                      if (err) {
                        return done(err);
                      } else {
                        return done();
                      }
                    })
            );

        it("should add all channels in the defaultChannelConfig property", done =>
                new Mediator(mediator1).save((err) => {
                  if (err) { return done(err); }
                  return request("https://localhost:8080")
                        .post("/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/channels")
                        .set("auth-username", testUtils.rootUser.email)
                        .set("auth-ts", authDetails.authTS)
                        .set("auth-salt", authDetails.authSalt)
                        .set("auth-token", authDetails.authToken)
                        .send([])
                        .expect(201)
                        .end((err, res) => {
                          if (err) { return done(err); }
                          return Channel.find({}, (err, channels) => {
                            if (err) { return done(err); }
                            channels.length.should.be.exactly(2);
                            const channelNames = channels.map(channel => channel.name);
                            channelNames.should.containEql("Save Encounter 1");
                            channelNames.should.containEql("Save Encounter 2");
                            return done();
                          });
                        });
                })
            );

        it("should add selected channels in the defaultChannelConfig property if the body is set (save one)", done =>
                new Mediator(mediator1).save(() =>
                    request("https://localhost:8080")
                        .post("/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/channels")
                        .set("auth-username", testUtils.rootUser.email)
                        .set("auth-ts", authDetails.authTS)
                        .set("auth-salt", authDetails.authSalt)
                        .set("auth-token", authDetails.authToken)
                        .send(["Save Encounter 2"])
                        .expect(201)
                        .end((err, res) => {
                          if (err) {
                            return done(err);
                          } else {
                            return Channel.find({}, (err, channels) => {
                              if (err) { done(err); }
                              channels.length.should.be.exactly(1);
                              channels[0].name.should.be.exactly("Save Encounter 2");
                              return done();
                            });
                          }
                        })
                )
            );

        it("should add selected channels in the defaultChannelConfig property if the body is set (save both)", done =>
                new Mediator(mediator1).save(() =>
                    request("https://localhost:8080")
                        .post("/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/channels")
                        .set("auth-username", testUtils.rootUser.email)
                        .set("auth-ts", authDetails.authTS)
                        .set("auth-salt", authDetails.authSalt)
                        .set("auth-token", authDetails.authToken)
                        .send(["Save Encounter 1", "Save Encounter 2"])
                        .expect(201)
                        .end((err, res) => {
                          if (err) {
                            return done(err);
                          } else {
                            return Channel.find({}, (err, channels) => {
                              if (err) { done(err); }
                              channels.length.should.be.exactly(2);
                              const channelNames = channels.map(channel => channel.name);
                              channelNames.should.containEql("Save Encounter 1");
                              channelNames.should.containEql("Save Encounter 2");
                              return done();
                            });
                          }
                        })
                )
            );

        it("should return a 400 when a channel from the request body isn't found", done =>
                new Mediator(mediator1).save(() =>
                    request("https://localhost:8080")
                        .post("/mediators/urn:uuid:EEA84E13-1C92-467C-B0BD-7C480462D1ED/channels")
                        .set("auth-username", testUtils.rootUser.email)
                        .set("auth-ts", authDetails.authTS)
                        .set("auth-salt", authDetails.authSalt)
                        .set("auth-token", authDetails.authToken)
                        .send(["Something Wrong"])
                        .expect(400)
                        .end((err, res) => {
                          if (err) {
                            return done(err);
                          } else {
                            return done();
                          }
                        })
                )
            );

        return it("should return a 404 if the mediator isn't found", done =>
                request("https://localhost:8080")
                    .post("/mediators/urn:uuid:MISSING/channels")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .send([])
                    .expect(404)
                    .end((err, res) => {
                      if (err) {
                        return done(err);
                      } else {
                        return done();
                      }
                    })
            );
      });
    })
);
