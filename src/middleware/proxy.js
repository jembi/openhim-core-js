import logger from "winston";
import Q from "q";
import SDC from "statsd-client";
import os from "os";
import { config } from "../config";

const statsdServer = config.get("statsd");
const application = config.get("application");

const domain = `${os.hostname()}.${application.name}.appMetrics`;
const sdc = new SDC(statsdServer);

export function setupProxyHeaders(ctx) {
    // Headers
    function setOrAppendHeader(ctx, header, value) {
        if (!value) { return; }
        if (ctx.header[header]) {
            return ctx.header[header] = `${ctx.header[header]}, ${value}`;
        } else {
            return ctx.header[header] = `${value}`;
        }
    }
    setOrAppendHeader(ctx, "X-Forwarded-For", ctx.request.ip);
    return setOrAppendHeader(ctx, "X-Forwarded-Host", ctx.request.host);
}

export function* koaMiddleware(next) {
    let startTime;
    if (statsdServer.enabled) { startTime = new Date(); }
    exports.setupProxyHeaders(this);
    if (statsdServer.enabled) { sdc.timing(`${domain}.proxyHeadersMiddleware`, startTime); }
    return yield next;
}
