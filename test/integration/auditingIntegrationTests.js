/* eslint-env mocha */

import should from "should";
import fs from "fs";
import tls from "tls";
import net from "net";
import dgram from "dgram";
import { Audit } from "../../src/model/audits";
import * as server from "../../src/server";
import * as testUtils from "../testUtils";
import { testAuditMessage } from "../unit/auditingTest";

describe("Auditing Integration Tests", () => {
    beforeEach(done => Audit.remove({}, () => server.start({ auditUDPPort: 5050, auditTlsPort: 5051, auditTcpPort: 5052 }, () => done())));

    afterEach(done => server.stop(() => done()));

    before(done => testUtils.setupTestKeystore(() => done()));

    after(done => testUtils.cleanupTestKeystore(() => done()));

    describe("UDP Audit Server", () =>
        it("should receive and persist audit messages", (done) => {
            const client = dgram.createSocket("udp4");
            return client.send(testAuditMessage, 0, testAuditMessage.length, 5050, "localhost", (err) => {
                client.close();

                if (err) { return done(err); }

                const checkAudits = () => Audit.find({}, (err, audits) => {
                    if (err) { return done(err); }

                    // message fields already validate heavily in unit test, just perform basic check
                    audits.length.should.be.exactly(2); // 1 extra due to automatic actor start audit
                    audits[1].rawMessage.should.be.exactly(testAuditMessage);
                    return done();
                });

                // async test :(
                return setTimeout(checkAudits, 100 * global.testTimeoutFactor);
            });
        })
    );

    describe("TLS Audit Server", () => {
        it("should send TLS audit messages and save (valid)", (done) => {
            const options = {
                cert: fs.readFileSync("test/resources/trust-tls/cert1.pem"),
                key: fs.readFileSync("test/resources/trust-tls/key1.pem"),
                ca: [fs.readFileSync("test/resources/server-tls/cert.pem")]
            };

            const client = tls.connect(5051, "localhost", options, () => {
                const messagePrependlength = `${testAuditMessage.length} ${testAuditMessage}`;
                return client.write(messagePrependlength, (err) => {
                    if (err) { return done(err); }
                    return client.end();
                });
            });

            return client.on("end", () => {
                const checkAudits = () => Audit.find({}, (err, audits) => {
                    if (err) { return done(err); }

                    // message fields already validate heavily in unit test, just perform basic check
                    audits.length.should.be.exactly(2); // 1 extra due to automatic actor start audit
                    audits[1].rawMessage.should.be.exactly(testAuditMessage);
                    return done();
                });
                return setTimeout(checkAudits, 100 * global.testTimeoutFactor);
            });
        });

        return it("should send TLS audit messages and NOT save (Invalid)", (done) => {
            const options = {
                cert: fs.readFileSync("test/resources/trust-tls/cert1.pem"),
                key: fs.readFileSync("test/resources/trust-tls/key1.pem"),
                ca: [fs.readFileSync("test/resources/server-tls/cert.pem")]
            };

            const client = tls.connect(5051, "localhost", options, () =>
                client.write(testAuditMessage, (err) => {
                    if (err) { return done(err); }
                    return client.end();
                })
            );

            return client.on("end", () => {
                const checkAudits = () => Audit.find({}, (err, audits) => {
                    if (err) { return done(err); }

                    // message fields already validate heavily in unit test, just perform basic check
                    audits.length.should.be.exactly(1); // 1 extra due to automatic actor start audit
                    return done();
                });
                return setTimeout(checkAudits, 100 * global.testTimeoutFactor);
            });
        });
    });

    return describe("TCP Audit Server", () => {
        it("should send TCP audit messages and save (valid)", (done) => {
            const client = net.connect(5052, "localhost", () => {
                const messagePrependlength = `${testAuditMessage.length} ${testAuditMessage}`;
                return client.write(messagePrependlength, (err) => {
                    if (err) { return done(err); }
                    return client.end();
                });
            });

            return client.on("end", () => {
                const checkAudits = () => Audit.find({}, (err, audits) => {
                    if (err) { return done(err); }

                    // message fields already validate heavily in unit test, just perform basic check
                    audits.length.should.be.exactly(2);  // 1 extra due to automatic actor start audit
                    audits[1].rawMessage.should.be.exactly(testAuditMessage);
                    return done();
                });
                return setTimeout(checkAudits, 100 * global.testTimeoutFactor);
            });
        });

        return it("should send TCP audit message and NOT save (Invalid)", (done) => {
            const client = net.connect(5052, "localhost", () =>
                // testAuditMessage does not have message length with space prepended
                client.write(testAuditMessage, (err) => {
                    if (err) { return done(err); }
                    return client.end();
                })
            );

            return client.on("end", () => {
                const checkAudits = () => Audit.find({}, (err, audits) => {
                    if (err) { return done(err); }

                    // message fields already validate heavily in unit test, just perform basic check
                    audits.length.should.be.exactly(1); // 1 extra due to automatic actor start audit
                    return done();
                });
                return setTimeout(checkAudits, 100 * global.testTimeoutFactor);
            });
        });
    });
});
