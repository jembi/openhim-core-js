// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import koa from "koa";
import route from "koa-route";
import cors from "koa-cors";
import bodyParser from "koa-body-parser";
import Q from "q";
import router from "./middleware/router";
import authentication from "./api/authentication";
import users from "./api/users";
import clients from "./api/clients";
import roles from "./api/roles";
import transactions from "./api/transactions";
import channels from "./api/channels";
import tasks from "./api/tasks";
import contactGroups from "./api/contactGroups";
import events from "./api/events";
import mediators from "./api/mediators";
import metrics from "./api/metrics";
import keystore from "./api/keystore";
import serverRestart from "./api/restart";
import audits from "./api/audits";
import config from "./config/config";
import heartbeat from "./api/heartbeat";
import certificateAuthority from "./api/certificateAuthority";
import logs from "./api/logs";
import metadata from "./api/metadata";
import visualizers from "./api/visualizers";
import about from "./api/about";

export function setupApp(done) {
	// Create an instance of the koa-server and add a body-parser
	const app = koa();
	app.use(cors());
	const limitMB = config.api.maxPayloadSizeMB || 16;
	app.use(bodyParser({ limit: limitMB * 1024 * 1024 }));

	// Expose uptime server stats route before the auth middleware so that it is publically accessible
	app.use(route.get("/heartbeat", heartbeat.getHeartbeat));

	// Expose the set-user-password route before the auth middleware so that it is publically accessible
	app.use(route.get("/password-reset-request/:email", users.userPasswordResetRequest));
	app.use(route.get("/token/:token", users.getUserByToken));
	app.use(route.put("/token/:token", users.updateUserByToken));


	// Expose the authenticate route before the auth middleware so that it is publically accessible
	app.use(route.get("/authenticate/:username", users.authenticate));
	// Authenticate the API request
	app.use(authentication.authenticate);

	// Define the api routes
	app.use(route.get("/users", users.getUsers));
	app.use(route.get("/users/:email", users.getUser));
	app.use(route.post("/users", users.addUser));
	app.use(route.put("/users/:email", users.updateUser));
	app.use(route.delete("/users/:email", users.removeUser));

	app.use(route.get("/clients", clients.getClients));
	app.use(route.get("/clients/:clientId", clients.getClient));
	app.use(route.post("/clients", clients.addClient));
	app.use(route.get("/clients/domain/:clientDomain", clients.findClientByDomain));
	app.use(route.put("/clients/:clientId", clients.updateClient));
	app.use(route.delete("/clients/:clientId", clients.removeClient));
	app.use(route.get("/clients/:clientId/:property", clients.getClient));

	app.use(route.get("/roles", roles.getRoles));
	app.use(route.post("/roles", roles.addRole));
	app.use(route.get("/roles/:name", roles.getRole));
	app.use(route.put("/roles/:name", roles.updateRole));
	app.use(route.delete("/roles/:name", roles.deleteRole));

	app.use(route.get("/transactions", transactions.getTransactions));
	app.use(route.post("/transactions", transactions.addTransaction));
	app.use(route.get("/transactions/:transactionId", transactions.getTransactionById));
	app.use(route.get("/transactions/clients/:clientId", transactions.findTransactionByClientId));
	app.use(route.put("/transactions/:transactionId", transactions.updateTransaction));
	app.use(route.delete("/transactions/:transactionId", transactions.removeTransaction));

	app.use(route.get("/groups", contactGroups.getContactGroups));
	app.use(route.get("/groups/:contactGroupId", contactGroups.getContactGroup));
	app.use(route.post("/groups", contactGroups.addContactGroup));
	app.use(route.put("/groups/:contactGroupId", contactGroups.updateContactGroup));
	app.use(route.delete("/groups/:contactGroupId", contactGroups.removeContactGroup));

	app.use(route.get("/channels", channels.getChannels));
	app.use(route.post("/channels", channels.addChannel));
	app.use(route.get("/channels/:channelId", channels.getChannel));
	app.use(route.post("/channels/:channelId/trigger", channels.triggerChannel));
	app.use(route.put("/channels/:channelId", channels.updateChannel));
	app.use(route.delete("/channels/:channelId", channels.removeChannel));

	app.use(route.get("/tasks", tasks.getTasks));
	app.use(route.post("/tasks", tasks.addTask));
	app.use(route.get("/tasks/:taskId", tasks.getTask));
	app.use(route.put("/tasks/:taskId", tasks.updateTask));
	app.use(route.delete("/tasks/:taskId", tasks.removeTask));

	app.use(route.get("/metrics", function () { return metrics.getMetrics.call(this, false); }));
	app.use(route.get("/metrics/channels", function () { return metrics.getMetrics.call(this, true); }));
	app.use(route.get("/metrics/channels/:channelID", function (channelID) { return metrics.getMetrics.call(this, true, null, channelID); }));
	app.use(route.get("/metrics/timeseries/:timeSeries", function (timeSeries) { return metrics.getMetrics.call(this, false, timeSeries); }));
	app.use(route.get("/metrics/timeseries/:timeSeries/channels", function (timeSeries) { return metrics.getMetrics.call(this, true, timeSeries); }));
	app.use(route.get("/metrics/timeseries/:timeSeries/channels/:channelID", function (timeSeries, channelID) { return metrics.getMetrics.call(this, true, timeSeries, channelID); }));

	app.use(route.get("/mediators", mediators.getAllMediators));
	app.use(route.get("/mediators/:uuid", mediators.getMediator));
	app.use(route.post("/mediators", mediators.addMediator));
	app.use(route.delete("/mediators/:urn", mediators.removeMediator));
	app.use(route.post("/mediators/:urn/heartbeat", mediators.heartbeat));
	app.use(route.put("/mediators/:urn/config", mediators.setConfig));
	app.use(route.post("/mediators/:urn/channels", mediators.loadDefaultChannels));

	app.use(route.get("/keystore/cert", keystore.getServerCert));
	app.use(route.post("/keystore/cert", keystore.setServerCert));
	app.use(route.get("/keystore/ca", keystore.getCACerts));
	app.use(route.get("/keystore/ca/:certId", keystore.getCACert));
	app.use(route.delete("/keystore/ca/:certId", keystore.removeCACert));
	app.use(route.post("/keystore/key", keystore.setServerKey));
	app.use(route.post("/keystore/ca/cert", keystore.addTrustedCert));
	app.use(route.get("/keystore/validity", keystore.verifyServerKeys));
	app.use(route.post("/keystore/passphrase", keystore.setServerPassphrase));

	// Metadata endpoints
	app.use(route.get("/metadata", metadata.getMetadata));
	app.use(route.post("/metadata/validate", metadata.validateMetadata));
	app.use(route.post("/metadata", metadata.importMetadata));

	// Server restart endpoint
	app.use(route.post("/restart", serverRestart.restart));

	// AuditRecord endpoint
	app.use(route.post("/audits", audits.addAudit));
	app.use(route.get("/audits", audits.getAudits));
	app.use(route.get("/audits/:auditId", audits.getAuditById));
	app.use(route.get("/audits-filter-options", audits.getAuditsFilterOptions));

	// Ceritficates endpoint
	app.use(route.post("/certificates", certificateAuthority.generateCert));

	// Logs endpoint
	app.use(route.get("/logs", logs.getLogs));

	// Events endpoint
	app.use(route.get("/events/:receivedTime", events.getLatestEvents));

	// Version endpoint
	app.use(route.get("/about", about.getAboutInformation));

	// Visualizer endpoint
	app.use(route.get("/visualizers", visualizers.getVisualizers));
	app.use(route.get("/visualizers/:visualizerId", visualizers.getVisualizer));
	app.use(route.post("/visualizers", visualizers.addVisualizer));
	app.use(route.put("/visualizers/:visualizerId", visualizers.updateVisualizer));
	app.use(route.delete("/visualizers/:visualizerId", visualizers.removeVisualizer));

	// Return the result
	return done(app);
}