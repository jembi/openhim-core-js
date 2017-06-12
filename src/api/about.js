import logger from "winston";
import * as utils from "../utils";
import { version as currentCoreVersion } from "../../package.json";

export function* getAboutInformation() {
	try {
		this.body = yield { currentCoreVersion, serverTimezone: utils.serverTimezone() };
		this.status = 200;
		return logger.info(`User ${this.authenticated.email} successfully fetched 'about' information`);
	} catch (e) {
		this.body = e.message;
		return utils.logAndSetResponse(this, 500, `Could not fetch 'about' info via the API ${e}`, "error");
	}
}
