// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import should from "should";
import request from "supertest";
import { Client } from "../../lib/model/clients";
import server from "../../lib/server";
import testUtils from "../testUtils";
import { auth } from "../testUtils";

describe("API Integration Tests", () =>

  describe("Clients REST Api Testing", function() {

    let testAppDoc = {
      clientID: "YUIAIIIICIIAIA",
      clientDomain: "him.jembi.org",
      name: "OpenMRS Ishmael instance",
      roles: [
          "OpenMRS_PoC",
          "PoC"
        ],
      passwordHash: "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy",
      certFingerprint: "23:37:6A:5E:A9:13:A4:8C:66:C5:BB:9F:0E:0D:68:9B:99:80:10:FC"
    };

    let authDetails = {};

    before(done =>
      auth.setupTestUsers(err =>
        server.start({apiPort: 8080}, () => done())
      )
    );

    after(done =>
      auth.cleanupTestUsers(err =>
        server.stop(() => done())
      )
    );

    beforeEach(() => authDetails = auth.getAuthDetails());

    afterEach(done =>
      Client.remove(() => done())
    );

    describe("*addClient", function() {

      it("should add client to db and return status 201 - client created", done =>
        request("https://localhost:8080")
          .post("/clients")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(testAppDoc)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            } else {
              return Client.findOne({ clientID: "YUIAIIIICIIAIA" }, function(err, client) {
                client.clientID.should.equal("YUIAIIIICIIAIA");
                client.clientDomain.should.equal("him.jembi.org");
                client.name.should.equal("OpenMRS Ishmael instance");
                client.roles[0].should.equal("OpenMRS_PoC");
                client.roles[1].should.equal("PoC");
                client.passwordHash.should.equal("$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy");
                client.certFingerprint.should.equal("23:37:6A:5E:A9:13:A4:8C:66:C5:BB:9F:0E:0D:68:9B:99:80:10:FC");
                return done();
              });
            }
        })
      );

      it("should only allow an admin user to add a client", done =>
        request("https://localhost:8080")
          .post("/clients")
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(testAppDoc)
          .expect(403)
          .end(function(err, res) {
            if (err) {
              return done(err);
            } else {
              return done();
            }
        })
      );

      return it("should reject a client that conflicts with a role", function(done) {
        let client = new Client(testAppDoc);
        return client.save(function() {
          let conflict = Object.assign({}, testAppDoc);
          conflict.clientID = "PoC";
          return request("https://localhost:8080")
            .post("/clients")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(conflict)
            .expect(409)
            .end(function(err, res) {
              if (err) {
                return done(err);
              } else {
                return done();
              }
          });
        });
      });
    });

    describe("*getClient(_id)", function() {
      let clientTest = {
        clientID: "testClient",
        clientDomain: "www.zedmusic-unique.co.zw",
        name: "OpenHIE NodeJs",
        roles: [
            "test_role_PoC",
            "monitoring"
          ],
        passwordHash: "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
      };

      let clientId = null;

      beforeEach(function(done) {
        let client = new Client(clientTest);
        return client.save(function(err, client) {
          clientId = client._id;
          if (err) { done(err); }
          return done();
        });
      });

      it("should get client by clientId and return status 200", done =>
        request("https://localhost:8080")
          .get(`/clients/${clientId}`)
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            } else {
              res.body.clientID.should.equal("testClient");
              res.body.clientDomain.should.equal("www.zedmusic-unique.co.zw");
              res.body.name.should.equal("OpenHIE NodeJs");
              res.body.roles[0].should.equal("test_role_PoC");
              res.body.roles[1].should.equal("monitoring");
              res.body.passwordHash.should.equal("$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy");
              return done();
            }
        })
      );

      it("should return status 404 if not found", done =>
        request("https://localhost:8080")
          .get("/clients/000000000000000000000000")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(404)
          .end(function(err, res) {
            if (err) {
              return done(err);
            } else {
              return done();
            }
        })
      );

      it("should not allow a non admin user to fetch a client", done =>
        request("https://localhost:8080")
          .get(`/clients/${clientId}`)
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(403)
          .end(function(err, res) {
            if (err) {
              return done(err);
            } else {
              return done();
            }
        })
      );

      return it("should allow a non admin user to fetch a limited view of a client", done =>
        request("https://localhost:8080")
          .get(`/clients/${clientId}/clientName`)
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            } else {
              res.body.name.should.equal("OpenHIE NodeJs");

              should.not.exist(res.body.clientID);
              should.not.exist(res.body.domainName);
              should.not.exist(res.body.roles);
              should.not.exist(res.body.passwordHash);
              return done();
            }
        })
      );
    });


    describe("*findClientByDomain(clientDomain)", function() {
      let clientTest = {
        clientID: "Zambia_OpenHIE_Instance",
        clientDomain: "www.zedmusic-unique.co.zw",
        name: "OpenHIE NodeJs",
        roles: [
            "test_role_PoC",
            "monitoring"
          ],
        passwordHash: "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
      };

      it("should return client with specified clientDomain", function(done) {
        let client = new Client(clientTest);
        return client.save(function(error, newApp) {
          should.not.exist((error));
          return request("https://localhost:8080")
            .get("/clients/domain/www.zedmusic-unique.co.zw")
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              } else {
                res.body.clientID.should.equal("Zambia_OpenHIE_Instance");
                res.body.clientDomain.should.equal("www.zedmusic-unique.co.zw");
                res.body.name.should.equal("OpenHIE NodeJs");
                res.body.roles[0].should.equal("test_role_PoC");
                res.body.roles[1].should.equal("monitoring");
                res.body.passwordHash.should.equal("$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy");
                return done();
              }
          });
        });
      });

      return it("should not allow a non admin user to fetch a client by domain", done =>
        request("https://localhost:8080")
          .get("/clients/domain/www.zedmusic-unique.co.zw")
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(403)
          .end(function(err, res) {
            if (err) {
              return done(err);
            } else {
              return done();
            }
        })
      );
    });

    describe("*getClients()", function() {
      let testDocument = {
        clientID: "Botswana_OpenHIE_Instance",
        clientDomain: "www.zedmusic.co.zw",
        name: "OpenHIE NodeJs",
        roles: [
            "test_role_PoC",
            "analysis_POC"
          ],
        passwordHash: "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
      };

      it("should return all clients ", done =>
        Client.count(function(err, countBefore){
          let client = new Client(testDocument);
          client.clientID += "1";
          return client.save(function(error, testDoc) {
            should.not.exist((error));
            client = new Client(testDocument);
            client.clientID += "2";
            return client.save(function(error, testDoc) {
              should.not.exist(error);
              client = new Client(testDocument);
              client.clientID += "3";
              return client.save(function(error, testDoc) {
                should.not.exist(error);
                client = new Client(testDocument);
                client.clientID += "4";
                return client.save(function(error, testDoc) {
                  should.not.exist((error));
                  return request("https://localhost:8080")
                    .get("/clients")
                    .set("auth-username", testUtils.rootUser.email)
                    .set("auth-ts", authDetails.authTS)
                    .set("auth-salt", authDetails.authSalt)
                    .set("auth-token", authDetails.authToken)
                    .expect(200)
                    .end(function(err, res) {
                      if (err) {
                        return done(err);
                      } else {
                        res.body.length.should.equal(countBefore + 4);
                        return done();
                      }
                  });
                });
              });
            });
          });
        })
      );

      return it("should not allow a non admin user to fetch all clients", done =>
        request("https://localhost:8080")
          .get("/clients")
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(403)
          .end(function(err, res) {
            if (err) {
              return done(err);
            } else {
              return done();
            }
        })
      );
    });

    describe("*updateClient", function() {
      let testDocument = {
        clientID: "Botswana_OpenHIE_Instance",
        clientDomain: "www.zedmusic.co.zw",
        name: "OpenHIE NodeJs",
        roles: [
            "test_role_PoC",
            "analysis_POC"
          ],
        passwordHash: "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
      };

      it("should update the specified client ", function(done) {
        let client = new Client(testDocument);
        return client.save(function(error, testDoc) {
          should.not.exist((error));

          let updates = {
            _id: "thisShouldBeIgnored",
            roles:   [
                  "clientTest_update"
                ],
            passwordHash: "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy",
            name: "Devil_may_Cry"
          };
          return request("https://localhost:8080")
            .put(`/clients/${client._id}`)
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(updates)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              } else {
                return Client.findById(client._id, function(error, clientDoc) {
                  clientDoc.roles[0].should.equal("clientTest_update");
                  clientDoc.passwordHash.should.equal("$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy");
                  clientDoc.name.should.equal("Devil_may_Cry");
                  return done();
                });
              }
          });
        });
      });

      it("should update successfully if the _id field is present in update, ignoring it", function(done) {
        let client = new Client(testDocument);
        return client.save(function(error, testDoc) {
          should.not.exist((error));

          let updates = {
            _id: "not_a_real_id",
            roles:   [
                  "clientTest_update"
                ],
            passwordHash: "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy",
            name: "Devil_may_Cry"
          };
          return request("https://localhost:8080")
            .put(`/clients/${client._id}`)
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(updates)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              } else {
                return Client.findById(client._id, function(error, clientDoc) {
                  clientDoc.roles[0].should.equal("clientTest_update");
                  clientDoc.passwordHash.should.equal("$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy");
                  clientDoc.name.should.equal("Devil_may_Cry");
                  return done();
                });
              }
          });
        });
      });

      it("should not allow a non admin user to update a client", function(done) {
        let updates = {};
        return request("https://localhost:8080")
          .put("/clients/000000000000000000000000")
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(updates)
          .expect(403)
          .end(function(err, res) {
            if (err) {
              return done(err);
            } else {
              return done();
            }
        });
      });

      return it("should reject a client that conflicts with a role", function(done) {
        let client = new Client(testAppDoc);
        return client.save(function() {
          let conflict = { clientID: "PoC" };
          return request("https://localhost:8080")
            .put(`/clients/${client._id}`)
            .set("auth-username", testUtils.rootUser.email)
            .set("auth-ts", authDetails.authTS)
            .set("auth-salt", authDetails.authSalt)
            .set("auth-token", authDetails.authToken)
            .send(conflict)
            .expect(409)
            .end(function(err, res) {
              if (err) {
                return done(err);
              } else {
                return done();
              }
          });
        });
      });
    });

    return describe("*removeClient", function() {
      it("should remove an client with specified clientID", function(done) {
        let docTestRemove = {
          clientID: "Jembi_OpenHIE_Instance",
          clientDomain: "www.jembi.org",
          name: "OpenHIE NodeJs",
          roles: [
              "test_role_PoC",
              "analysis_POC"
            ],
          passwordHash: "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
        };

        let client = new Client(docTestRemove);
        return client.save(function(error, testDoc) {
          should.not.exist(error);
          return Client.count((err, countBefore) =>
            request("https://localhost:8080")
              .del(`/clients/${client._id}`)
              .set("auth-username", testUtils.rootUser.email)
              .set("auth-ts", authDetails.authTS)
              .set("auth-salt", authDetails.authSalt)
              .set("auth-token", authDetails.authToken)
              .expect(200)
              .end(function(err, res) {
                if (err) {
                  return done(err);
                } else {
                  return Client.count((err, countAfter) =>
                    Client.findOne({ clientID: "Jembi_OpenHIE_Instance" }, function(error, notFoundDoc) {
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

      return it("should not allow a non admin user to remove a client", function(done) {
        let docTestRemove = {};
        return request("https://localhost:8080")
          .del("/clients/000000000000000000000000")
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(403)
          .end(function(err, res) {
            if (err) {
              return done(err);
            } else {
              return done();
            }
        });
      });
    });
  })
);
