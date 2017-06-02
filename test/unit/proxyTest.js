import should from "should";
import sinon from "sinon";
import http from "http";
import proxy from "../../lib/middleware/proxy";

describe("Proxy", function() {
  let ctx = {};
  ctx.header = {};
  ctx.request = {};
  ctx.request.ip = '192.168.1.42';
  ctx.request.host = 'localhost:5000';
  ctx.request.protocol = 'https';

  return describe(".setupProxyHeaders", function() {
    it("should set the X-Forwarded-* headers if not present", function(done) {
      delete ctx.header['X-Forwarded-For'];
      delete ctx.header['X-Forwarded-Host'];
      proxy.setupProxyHeaders(ctx);
      ctx.header['X-Forwarded-For'].should.equal('192.168.1.42');
      ctx.header['X-Forwarded-Host'].should.equal('localhost:5000');
      return done();
    });

    return it("should append values to the X-Forwarded-* headers if already present", function(done) {
      ctx.header['X-Forwarded-For'] = '192.168.2.34';
      ctx.header['X-Forwarded-Host'] = 'someserver.com';
      proxy.setupProxyHeaders(ctx);
      ctx.header['X-Forwarded-For'].should.equal('192.168.2.34, 192.168.1.42');
      ctx.header['X-Forwarded-Host'].should.equal('someserver.com, localhost:5000');
      return done();
    });
  });
});
