import moment from "moment";
import Q from "q";
import utils from "../utils";
import server from "../server";
import { Mediator } from "../model/mediators";

export function* getHeartbeat() {
	try {
		const uptime = Q.denodeify(server.getUptime);
		const result = yield uptime;

		const mediators = yield Mediator.find().exec();
		for (const mediator of Array.from(mediators)) {
			if (!result.mediators) { result.mediators = {}; }

			if ((mediator._lastHeartbeat != null) && (mediator._uptime != null) &&
				// have we received a heartbeat within the last minute?
				(moment().diff(mediator._lastHeartbeat, "seconds") <= 60)) {
				result.mediators[mediator.urn] = mediator._uptime;
			} else {
				result.mediators[mediator.urn] = null;
			}
		}

		result.now = Date.now();
		return this.body = result;
	} catch (e) {
		return utils.logAndSetResponse(this, 500, `Error: ${e}`, "error");
	}
}
