// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import should from "should";
import utils from "../../lib/utils";

describe("Utils", () =>

  describe(".statusCodePatternMatch()", function() {

    it("should return true when pattern value match status code (2xx)", function(done) {
      let result = utils.statusCodePatternMatch('2xx');
      result.should.be.true;
      return done();
    });

    it("should return true when pattern value match status code (2)", function(done) {
      let result = utils.statusCodePatternMatch('2xx');
      result.should.be.true;
      return done();
    });

    it("should return false when pattern value does NOT match status code (200)", function(done) {
      let result = utils.statusCodePatternMatch('200');
      result.should.be.false;
      return done();
    });

    return it("should return server timezone", function(done) {
      let result = utils.serverTimezone();
      should.exist(result);
      return done();
    });
  })
);
