/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import should from "should";
import sinon from "sinon";
import tcpAdapter from "../../lib/tcpAdapter";
import { Channel } from "../../lib/model/channels";

describe("TCP adapter tests", () => {
	const testChannel = new Channel({
		name: "test",
		urlPattern: "/test",
		allow: "*",
		type: "tcp",
		tcpPort: 4000,
		tcpHost: "localhost"
	});

	const disabledChannel = new Channel({
		name: "disabled",
		urlPattern: "/disabled",
		allow: "*",
		type: "tcp",
		tcpPort: 4001,
		tcpHost: "localhost",
		status: "disabled"
	});

	before(done => testChannel.save(() => disabledChannel.save(() => done())));

	after(done => tcpAdapter.stopServers(() => Channel.remove({}, done)));

	return describe(".startupServers", () =>
		it("should startup all enabled channels", (done) => {
			const spy = sinon.spy(tcpAdapter, "startupTCPServer");
			return tcpAdapter.startupServers(() => {
				try {
					spy.calledOnce.should.be.true;
					spy.calledWith(testChannel._id);
				} catch (err) {
					return done(err);
				}
				return done();
			});
		})
	);
});
