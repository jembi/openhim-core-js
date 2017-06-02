// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import upgradeDB from '../../lib/upgradeDB';
import testUtils from '../testUtils';
import { Keystore } from '../../lib/model/keystore';
import { Client } from '../../lib/model/clients';
import { User } from '../../lib/model/users';
import { Visualizer } from '../../lib/model/visualizer';
import Q from 'q';
import should from 'should';

describe('Upgrade DB Tests', function() {

  describe('.upgradeDB', function() {

    let func1Complete = false;
    let func2Complete = false;

    let mockUpgradeFunc1 = function() {
      let defer = Q.defer();
      setTimeout(function() {
        if (func2Complete) {
          throw new Error('Funtions ran non sequentially');
        } else {
          func1Complete = true;
          return defer.resolve();
        }
      }
      , 10 * global.testTimeoutFactor);
      return defer.promise;
    };

    let mockUpgradeFunc2 = function() {
      let defer = Q.defer();
      func2Complete = true;
      defer.resolve();
      return defer.promise;
    };

    return it('should run each upgrade function sequentially', function(done) {
      upgradeDB.upgradeFuncs.length = 0;
      upgradeDB.upgradeFuncs.push({
        description: 'mock func 1',
        func: mockUpgradeFunc1
      });
      upgradeDB.upgradeFuncs.push({
        description: 'mock func 2',
        func: mockUpgradeFunc2
      });

      return upgradeDB.upgradeDb(function() {
        func1Complete.should.be.exactly(true);
        func2Complete.should.be.exactly(true);
        return done();
      });
    });
  });

  describe('updateFunction0 - Ensure cert fingerprint', function() {

    let upgradeFunc = upgradeDB.upgradeFuncs[0].func;

    beforeEach(done =>
      testUtils.setupTestKeystore(() =>
        Keystore.findOne(function(err, keystore) {
          keystore.cert.fingerprint = undefined;
          for (let cert of Array.from(keystore.ca)) {
            cert.fingerprint = undefined;
          }
          return keystore.save(function(err) {
            if (err) { logger.error(err); }
            return done();
          });
        })
      )
    );

    it('should add the fingerprint property to ca certificates', done =>
      upgradeFunc().then(() =>
        Keystore.findOne(function(err, keystore) {
          if (err) { logger.error(err); }
          for (let cert of Array.from(keystore.ca)) {
            cert.fingerprint.should.exist;
          }
          return done();
        })
      )
    );

    return it('should add the fingerprint property to server certificate', done =>
      upgradeFunc().then(() =>
        Keystore.findOne(function(err, keystore) {
          if (err) { logger.error(err); }
          keystore.cert.fingerprint.should.exist;
          return done();
        })
      )
    );
  });

  describe('updateFunction1 - Convert client.domain to client.fingerprint', function() {

    let upgradeFunc = upgradeDB.upgradeFuncs[1].func;

    let clientData = {
      clientID: "test",
      clientDomain: "trust1.org", // in default test keystore
      name: "Test client",
      roles: [
          "OpenMRS_PoC",
          "PoC"
        ]
    };

    before(done =>
      testUtils.setupTestKeystore(function() {
        let client = new Client(clientData);
        return client.save(function(err) {
          if (err != null) { logger.error(err); }
          return done();
        });
      })
    );

    return it('should convert client.domain match to client.certFingerprint match', () =>
      upgradeFunc().then(() =>
        Client.findOne({clientID: "test"}, (err, client) => client.certFingerprint.should.be.exactly("23:1D:0B:AA:70:06:A5:D4:DC:E9:B9:C3:BD:2C:56:7F:29:D2:3E:54"))
      )
    );
  });

  describe('updateFunction2 - Migrate visualizer settings from user profile to shared collection', function() {

    let upgradeFunc = upgradeDB.upgradeFuncs[2].func;

    let userObj1 = {
      firstname: "Test",
      surname: "User1",
      email: "test1@user.org",
      settings: {
        visualizer: {
          components: [{
              eventType: 'primary',
              eventName: 'OpenHIM Mediator FHIR Proxy Route',
              display: 'FHIR Server'
            }
            , {
              eventType: 'primary',
              eventName: 'echo',
              display: 'Echo'
            }
          ],
          color: {
            inactive: '#c8cacf',
            active: '#10e057',
            error: '#a84b5c',
            text: '#4a4254'
          },
          size: {
            responsive: true,
            width: 1000,
            height: 400,
            paddin: 20
          },
          time: {
            updatePeriod: 200,
            maxSpeed: 5,
            maxTimeout: 5000,
            minDisplayPeriod: 500
          },
          channels: [{
              eventType: 'channel',
              eventName: 'FHIR Proxy',
              display: 'FHIR Proxy'
            }
            , {
              eventType: 'channel',
              eventName: 'Echo',
              display: 'Echo'
            }
          ],
          mediators: [{
              mediator: 'urn:mediator:fhir-proxy',
              name: 'OpenHIM Mediator FHIR Proxy',
              display: 'OpenHIM Mediator FHIR Proxy'
            }
            , {
              mediator: 'urn:mediator:shell-script',
              name: 'OpenHIM Shell Script Mediator',
              display: 'OpenHIM Shell Script Mediator'
            }
          ]
        }
      }
    };
    let userObj2 = {
      firstname: "Test",
      surname: "User2",
      email: "test2@user.org",
      settings: {
        visualizer: {
          components: [{
              eventType: 'primary',
              eventName: 'OpenHIM Mediator FHIR Proxy Route',
              display: 'FHIR Server'
            }
          ],
          color: {
            inactive: '#c8cacf',
            active: '#10e057',
            error: '#a84b5c',
            text: '#4a4254'
          },
          size: {
            responsive: true,
            width: 1000,
            height: 400,
            paddin: 20
          },
          time: {
            updatePeriod: 200,
            maxSpeed: 5,
            maxTimeout: 5000,
            minDisplayPeriod: 500
          },
          channels: [{
              eventType: 'channel',
              eventName: 'FHIR Proxy',
              display: 'FHIR Proxy'
            }
          ],
          mediators: [{
              mediator: 'urn:mediator:fhir-proxy',
              name: 'OpenHIM Mediator FHIR Proxy',
              display: 'OpenHIM Mediator FHIR Proxy'
            }
          ]
        }
      }
    };
    let userObj3 = {
      firstname: "Test",
      surname: "User3",
      email: "test3@user.org",
      settings: {
        visualizer: {
          color: {
            inactive: '#c8cacf',
            active: '#10e057',
            error: '#a84b5c',
            text: '#4a4254'
          },
          size: {
            responsive: true,
            width: 1000,
            height: 400,
            paddin: 20
          },
          time: {
            updatePeriod: 200,
            maxSpeed: 5,
            maxTimeout: 5000,
            minDisplayPeriod: 500
          },
          components: [],
          channels: [],
          mediators: []
        }
      }
    };

    // from structure for Console v1.6.0
    let userObj4 = {
      settings: {
        list: {},
        visualizer: {
          time: {
            maxTimeout: 5000,
            maxSpeed: 5,
            updatePeriod: 200
          },
          size: {
            padding: 20,
            height: 400,
            width: 1000,
            responsive: true
          },
          color: {
            text: "000000",
            error: "d43f3a",
            active: "4cae4c",
            inactive: "CCCCCC"
          },
          endpoints: [{
              desc: "Test Channel",
              event: "channel-test"
            }
          ],
          components: [{
              desc: "Test",
              event: "test"
            }
            , {
              desc: "Test Route",
              event: "route-testroute"
            }
          ]
        },
        filter: {
          limit: 100
        }
      },
      email: "test4@user.org",
      firstname: "Test",
      surname: "User4",
      groups: [
        "admin"
      ]
    };

    // from structure for Console v1.6.0
    let userObj5 = {
      settings: {
        list: {},
        visualizer: {
          time: {
            maxTimeout: 5000,
            maxSpeed: 5,
            updatePeriod: 200
          },
          size: {
            padding: 20,
            height: 400,
            width: 1000,
            responsive: true
          },
          color: {
            text: "000000",
            error: "d43f3a",
            active: "4cae4c",
            inactive: "CCCCCC"
          },
          endpoints: [],
          components: []
        },
        filter: {
          limit: 100
        }
      },
      email: "test5@user.org",
      firstname: "Test",
      surname: "User5",
      groups: [
        "admin"
      ]
    };


    before(done =>
      User.remove(() =>
        Visualizer.remove(() => done())
      )
    );

    beforeEach(function(done) {
      let user = new User(userObj1);
      return user.save(function(err) {
        user = new User(userObj2);
        return user.save(function(err) {
          if (err != null) { return done(err); }
          return done();
        });
      });
    });

    afterEach(done =>
      User.remove(() =>
        Visualizer.remove(() => done())
      )
    );

    it('should migrate visualizer settings from user setting to shared collection', done =>
      upgradeFunc().then(() =>
        Visualizer.find(function(err, visualizers) {
          if (err) { return done(err); }
          visualizers.length.should.be.exactly(2);
          let names = visualizers.map(v => v.name);
          let idx1 = names.indexOf("Test User1's visualizer");
          let idx2 = names.indexOf("Test User2's visualizer");
          idx1.should.be.above(-1);
          visualizers[idx1].components.length.should.be.exactly(2);
          idx2.should.be.above(-1);
          visualizers[idx2].components.length.should.be.exactly(1);
          return done();
        })).catch(err => done(err))
    );

    it('should migrate visualizer settings even when user have the same name', done =>
      User.findOne({ surname: "User2" }, function(err, user) {
        user.surname = "User1";
        return user.save(function(err) {
          if (err) { return done(err); }
          return upgradeFunc().then(() =>
            Visualizer.find(function(err, visualizers) {
              if (err) { return done(err); }
              visualizers.length.should.be.exactly(2);
              let names = visualizers.map(v => v.name);
              let idx1 = names.indexOf("Test User1's visualizer");
              let idx2 = names.indexOf("Test User1's visualizer 2");
              idx1.should.be.above(-1);
              visualizers[idx1].components.length.should.be.exactly(2);
              idx2.should.be.above(-1);
              visualizers[idx2].components.length.should.be.exactly(1);
              return done();
            })).catch(err => done(err));
        });
      })
    );

    it('should remove the users visualizer setting from their profile', done =>
      upgradeFunc().then(() =>
        User.findOne({ email: "test1@user.org" }, function(err, user) {
          should.not.exist(user.settings.visualizer);
          return done();
        })
      )
    );

    it('should ignore users that don\'t have a settings.visualizer or settings set', done =>
      User.find(function(err, users) {
        users[0].set('settings.visualizer', null);
        users[1].set('settings', null);
        return users[0].save(err =>
          users[1].save(err =>
            upgradeFunc().then(() =>
              Visualizer.find(function(err, visualizers) {
                visualizers.length.should.be.exactly(0);
                return done();
              })).catch(err => done(err))
          )
        );
      })
    );

    it('should ignore users that have visualizer settings with no mediators, components or channels', function(done) {
      let user = new User(userObj3);
      return user.save(function(err) {
        if (err) { done(err); }
        return upgradeFunc().then(() =>
          Visualizer.find(function(err, visualizers) {
            visualizers.length.should.be.exactly(2); // third user is skipped
            return done();
          })).catch(err => done(err));
      });
    });

    it('should migrate old visualizers (core 2.0.0, console 1.6.0 and earlier)', function(done) {
      let user = new User(userObj4);
      return user.save(function(err) {
        if (err) { done(err); }
        return upgradeFunc().then(() =>
          Visualizer.find(function(err, visualizers) {
            visualizers.length.should.be.exactly(3);

            let names = visualizers.map(v => v.name);
            let idx = names.indexOf("Test User4's visualizer");

            visualizers[idx].time.minDisplayPeriod.should.be.exactly(100);
            visualizers[idx].mediators.length.should.be.exactly(0);

            visualizers[idx].channels.length.should.be.exactly(1);
            visualizers[idx].channels[0].eventType.should.be.equal('channel');
            visualizers[idx].channels[0].eventName.should.be.equal('test');
            visualizers[idx].channels[0].display.should.be.equal('Test Channel');

            visualizers[idx].components.length.should.be.exactly(2);
            visualizers[idx].components[0].eventType.should.be.equal('channel');
            visualizers[idx].components[0].eventName.should.be.equal('test');
            visualizers[idx].components[0].display.should.be.equal('Test');
            visualizers[idx].components[1].eventType.should.be.equal('route');
            visualizers[idx].components[1].eventName.should.be.equal('testroute');
            visualizers[idx].components[1].display.should.be.equal('Test Route');
            return done();
          })).catch(err => done(err));
      });
    });

    return it('should ignore users that have visualizer settings with no components or endpoints (core 2.0.0, console 1.6.0 and earlier)', function(done) {
      let user = new User(userObj5);
      return user.save(function(err) {
        if (err) { done(err); }
        return upgradeFunc().then(() =>
          Visualizer.find(function(err, visualizers) {
            visualizers.length.should.be.exactly(2);
            return done();
          })).catch(err => done(err));
      });
    });
  });

  return describe('dedupName()', function() {

    it('should correctly dedup a name', function() {
      let names = [ "Max", "Sam", "John" ];
      let name = upgradeDB.dedupName("Max", names);
      return name.should.be.exactly("Max 2");
    });

    it('should bump the increment if there are multiple dupes', function() {
      let names = [ "Max", "Max 2", "Max 3" ];
      let name = upgradeDB.dedupName("Max", names);
      return name.should.be.exactly("Max 4");
    });

    return it('should return the original name of no dupes', function() {
      let names = [ "Sam", "John", "Simon" ];
      let name = upgradeDB.dedupName("Max", names);
      return name.should.be.exactly("Max");
    });
  });
});
