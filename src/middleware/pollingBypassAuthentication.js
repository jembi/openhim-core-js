import Q from "q";
import logger from "winston";
import SDC from "statsd-client";
import os from "os";
import { Client } from "../model/clients";
import config from "../config/config";

const statsdServer = config.get("statsd");
const application = config.get("application");

const domain = `${os.hostname()}.${application.name}.appMetrics`;
const sdc = new SDC(statsdServer);

const dummyClient = new Client({
	clientID: "DUMMY-POLLING-USER",
	clientDomain: "openhim.org",
	name: "DUMMY-POLLING-USER",
	roles: ["polling"]
});

export function authenticateUser(ctx, done) {
	ctx.authenticated = dummyClient;
	return done(null, dummyClient);
}


/*
 * Koa middleware for bypassing authentication for polling requests
 */
export function* koaMiddleware(next) {
	let startTime;
	if (statsdServer.enabled) { startTime = new Date(); }
	const authenticateUser = Q.denodeify(exports.authenticateUser);
	yield authenticateUser(this);

	if (this.authenticated != null) {
		if (statsdServer.enabled) { sdc.timing(`${domain}.pollingBypassAuthenticationMiddleware`, startTime); }
		return yield next;
	} else {
		this.response.status = 401;
		if (statsdServer.enabled) { return sdc.timing(`${domain}.pollingBypassAuthenticationMiddleware`, startTime); }
	}
}
