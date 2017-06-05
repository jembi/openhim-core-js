// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import { dbVersion } from './model/dbVersion';
import { Keystore } from './model/keystore';
import { Client } from './model/clients';
import { User } from './model/users';
import { Visualizer } from './model/visualizer';
import logger from 'winston';
import pem from 'pem';
import Q from 'q';

var dedupName = function(name, names, num) {
  let newName;
  if (num) {
    newName = `${name} ${num}`;
  } else {
    newName = name;
  }
  if (Array.from(names).includes(newName)) {
    if (!num) {
      num = 1;
    }
    return dedupName(name, names, ++num);
  } else {
    return newName;
  }
};

// push new upgrade functions to this array, function must return a promise
// Warning: only add new function below existing functions, order matters!
let upgradeFuncs = [];

upgradeFuncs.push({
  description: "Ensure that all certs have a fingerprint property",
  func() {
    let defer = Q.defer();

    Keystore.findOne(function(err, keystore) {
      if (!keystore) { return defer.resolve(); }

      // convert server cert
      return pem.getFingerprint(keystore.cert.data, function(err, obj) {
        keystore.cert.fingerprint = obj.fingerprint;

        let promises = [];
        for (let i = 0; i < keystore.ca.length; i++) {
          var cert = keystore.ca[i];
          let caDefer = Q.defer();
          promises.push(caDefer.promise);
          ((caDefer, i) =>
            pem.getFingerprint(cert.data, function(err, obj) {
              keystore.ca[i].fingerprint = obj.fingerprint;
              return caDefer.resolve();
            })
          )(caDefer, i);
        }

        return Q.all(promises).then(() =>
          keystore.save(function(err) {
            if (err != null) { logger.error(`Failed to save keystore: ${err}`); }
            return defer.resolve();
          })
        );
      });
    });

    return defer.promise;
  }
});

upgradeFuncs.push({
  description: "Convert clients link to certs via their domain to use the cert fingerprint instead",
  func() {
    let defer = Q.defer();

    Client.find(function(err, clients) {
      if (err != null) {
        logger.error(`Couldn't fetch all clients to upgrade db: ${err}`);
        return defer.reject();
      }

      return Keystore.findOne(function(err, keystore) {
        if (err != null) {
          logger.error(`Couldn't fetch keystore to upgrade db: ${err}`);
          return defer.reject();
        }

        let promises = [];
        for (var client of Array.from(clients)) {
          let clientDefer = Q.defer();
          promises.push(clientDefer.promise);

          if ((keystore != null ? keystore.ca : undefined) != null) {
            for (let cert of Array.from(keystore.ca)) {
              if ((client.clientDomain === cert.commonName) && (client.certFingerprint == null)) {
                client.certFingerprint = cert.fingerprint;
                break;
              }
            }
          }

          (clientDefer =>
            client.save(function(err) {
              if (err != null) {
                logger.error(`Couldn't save client ${client.clientID} while upgrading db: ${err}`);
                return clientDefer.reject();
              }

              return clientDefer.resolve();
            })
          )(clientDefer);
        }

        return Q.all(promises).then(() => defer.resolve());
      });
    });

    return defer.promise;
  }
});

// Adapt visualizer from an old version (core 2.0.0, console 1.6.0 and earlier)
//
// We follow the same migration strategy as console:
// https://github.com/jembi/openhim-console/blob/1047b49db2050bafa6b4797e3788fa716d1760b3/app/scripts/controllers/profile.js#L83-L109
 function adaptOldVisualizerStructure(visualizer) {
  visualizer.channels = [];
  visualizer.mediators = [];
  visualizer.time.minDisplayPeriod = 100;

  if (visualizer.endpoints) {
    for (let endpoint of Array.from(visualizer.endpoints)) {
      visualizer.channels.push({
        eventType: 'channel',
        eventName: endpoint.event.replace('channel-', ''),
        display: endpoint.desc
      });
    }
    delete visualizer.endpoints;
  }

  if (visualizer.components) {
    return (() => {
      let result = [];
      for (let component of Array.from(visualizer.components)) {
        let split = component.event.split('-');
        if (split.length > 1) {
          component.eventType = split[0];
          component.eventName = split[1];
        } else {
          component.eventType = 'channel';
          component.eventName = component.event;
        }
        component.display = component.desc;
        delete component.event;
        result.push(delete component.desc);
      }
      return result;
    })();
  }
};


upgradeFuncs.push({
  description: "Migrate visualizer setting from a user's profile to a shared collection",
  func() {
    let defer = Q.defer();
    User.find(function(err, users) {
      if (err) {
        return Q.defer().reject(err);
      }

      let visNames = [];
      let promises = [];
      users.forEach(function(user) {
        if ((user.settings != null ? user.settings.visualizer : undefined) != null) {
          let vis = user.settings.visualizer;
          if (((vis.components != null ? vis.components.length : undefined) > 0) || ((vis.mediators != null ? vis.mediators.length : undefined) > 0) || ((vis.channels != null ? vis.channels.length : undefined) > 0) || ((vis.endpoints != null ? vis.endpoints.length : undefined) > 0)) {
            let userDefer = Q.defer();
            promises.push(userDefer.promise);

            if (vis.endpoints) { // old version
              adaptOldVisualizerStructure(vis);
            }

            let name = `${user.firstname} ${user.surname}'s visualizer`;
            name = dedupName(name, visNames);
            vis.name = name;
            visNames.push(name);

            vis = new Visualizer(vis);
            logger.debug(`Migrating visualizer from user profile ${user.email}, using visualizer name '${name}'`);
            return vis.save(function(err, vis) {
              if (err) {
                logger.error(`Error migrating visualizer from user profile ${user.email}: ${err.stack}`);
                return userDefer.reject(err);
              }

              // delete the visualizer settings from this user profile
              user.set('settings.visualizer', null);
              return user.save(function(err, user) {
                if (err) { return userDefer.reject(err); }
                return userDefer.resolve();
              });
            });
          }
        }
      });

      return Q.all(promises).then(() => defer.resolve()).catch(err => defer.reject(err));
    });

    return defer.promise;
  }
});

// add new upgrade functions here ^^

 function runUpgradeFunc(i, dbVer) {
  logger.info(`  \u2022 Running update: ${upgradeFuncs[i].description}...`);
  let defer = Q.defer();
  // run upgrade function
  upgradeFuncs[i].func().then(function() {
    // update the datbase version
    dbVer.version = i;
    dbVer.lastUpdated = new Date();
    return dbVer.save(function(err) {
      if (err != null) { logger.error(err); }
      logger.info("  \u2713 Done.");
      return defer.resolve();
    });}).catch(err => defer.reject(err));
  return defer.promise;
};

if (process.env.NODE_ENV === "test") {
  exports.upgradeFuncs = upgradeFuncs;
  exports.runUpgradeFunc = runUpgradeFunc;
  exports.dedupName = dedupName;
}

export function upgradeDb(callback) {
  return dbVersion.findOne(function(err, dbVer) {
    if (dbVer === null) {
      dbVer = new dbVersion({
        version: -1,
        lastUpdated: new Date()
      });
    }

    // check if the database version need to be upgraded
    if (dbVer.version < (upgradeFuncs.length - 1)) {
      logger.info('Upgrading the database...');
      let promise = null;
      // call each database upgrade function sequentially
      for (let start = dbVer.version + 1, i = start, end = upgradeFuncs.length - 1, asc = start <= end; asc ? i <= end : i >= end; asc ? i++ : i--) {
        (function(i) {
          if ((promise == null)) {
            return promise = runUpgradeFunc(i, dbVer);
          } else {
            return promise = promise.then(() => runUpgradeFunc(i, dbVer));
          }
        })(i);
      }

      return promise.then(function() {
        logger.info('Completed database upgrade');
        return callback();}).catch(function(err) {
        logger.error(`There was an error upgrading your database, you will need to fix this manually to continue. ${err.stack}`);
        return process.exit();
      });
    } else {
      logger.info('No database upgrades needed');
      return callback();
    }
  });
}

if (!module.parent) {
  exports.upgradeDb(() => process.exit());
}
