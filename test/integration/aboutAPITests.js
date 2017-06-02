// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import should from "should";
import request from "supertest";

import server from "../../lib/server";
import testUtils from "../testUtils";
import { auth } from "../testUtils";

describe("API Integration Tests", () =>

  describe("About Information REST Api Testing", function() {
    let authDetails = {};
    
    before(done =>
      server.start({apiPort: 8080}, () =>
        auth.setupTestUsers(function(err) {
          authDetails = auth.getAuthDetails();
          return done();
        })
      )
    );

    after(done =>
        server.stop(() =>
          auth.cleanupTestUsers(err => done())
        )
    );
    
    
    return describe("*getAboutInformation", function() {
  
      it("should fetch core version and return status 200", done =>
        request("https://localhost:8080")
          .get("/about")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            } else {
              res.body.should.have.property("currentCoreVersion");
              return done();
            }
        })
      );
      
      return it("should return 404 if not found", done =>
        request("https://localhost:8080")
          .get("/about/bleh")
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
    });
  })
);   