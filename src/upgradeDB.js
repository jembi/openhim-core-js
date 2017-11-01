import logger from 'winston'
import pem from 'pem'
import Q from 'q'
import { DbVersionModel } from './model/dbVersion'
import { KeystoreModel } from './model/keystore'
import { ClientModel } from './model/clients'
import { UserModel } from './model/users'
import { VisualizerModel } from './model/visualizer'

function dedupName (name, names, num) {
  let newName
  if (num) {
    newName = `${name} ${num}`
  } else {
    newName = name
  }
  if (Array.from(names).includes(newName)) {
    if (!num) {
      num = 1
    }
    return dedupName(name, names, ++num)
  } else {
    return newName
  }
}

// push new upgrade functions to this array, function must return a promise
// Warning: only add new function below existing functions, order matters!
const upgradeFuncs = []

upgradeFuncs.push({
  description: 'Ensure that all certs have a fingerprint property',
  func () {
    const defer = Q.defer()

    KeystoreModel.findOne((err, keystore) => {
      if (err) { return defer.reject(err) }
      if (!keystore) { return defer.resolve() }

      // convert server cert
      return pem.getFingerprint(keystore.cert.data, (err, obj) => {
        if (err) { return defer.reject(err) }
        keystore.cert.fingerprint = obj.fingerprint

        const promises = []
        for (let i = 0; i < keystore.ca.length; i++) {
          const cert = keystore.ca[i]
          const caDefer = Q.defer()
          promises.push(caDefer.promise)
          pem.getFingerprint(cert.data, (err, obj) => {
            if (err) { return defer.reject(err) }
            keystore.ca[i].fingerprint = obj.fingerprint
            return caDefer.resolve()
          })
        }

        Q.all(promises).then(() =>
          keystore.save((err) => {
            if (err != null) { logger.error(`Failed to save keystore: ${err}`) }
            return defer.resolve()
          })
        )
      })
    })

    return defer.promise
  }
})

upgradeFuncs.push({
  description: 'Convert clients link to certs via their domain to use the cert fingerprint instead',
  func () {
    const defer = Q.defer()

    ClientModel.find((err, clients) => {
      if (err != null) {
        logger.error(`Couldn't fetch all clients to upgrade db: ${err}`)
        return defer.reject()
      }

      KeystoreModel.findOne((err, keystore) => {
        if (err != null) {
          logger.error(`Couldn't fetch keystore to upgrade db: ${err}`)
          return defer.reject()
        }

        const promises = []
        for (const client of Array.from(clients)) {
          const clientDefer = Q.defer()
          promises.push(clientDefer.promise)

          if ((keystore != null ? keystore.ca : undefined) != null) {
            for (const cert of Array.from(keystore.ca)) {
              if ((client.clientDomain === cert.commonName) && (client.certFingerprint == null)) {
                client.certFingerprint = cert.fingerprint
                break
              }
            }
          }

          (clientDefer =>
              client.save((err) => {
                if (err != null) {
                  logger.error(`Couldn't save client ${client.clientID} while upgrading db: ${err}`)
                  return clientDefer.reject()
                }

                return clientDefer.resolve()
              }))(clientDefer)
        }

        Q.all(promises).then(() => defer.resolve())
      })
    })

    return defer.promise
  }
})

// Adapt visualizer from an old version (core 2.0.0, console 1.6.0 and earlier)
//
// We follow the same migration strategy as console:
// https://github.com/jembi/openhim-console/blob/1047b49db2050bafa6b4797e3788fa716d1760b3/app/scripts/controllers/profile.js#L83-L109
function adaptOldVisualizerStructure (visualizer) {
  visualizer.channels = []
  visualizer.mediators = []
  visualizer.time.minDisplayPeriod = 100

  if (visualizer.endpoints) {
    for (const endpoint of Array.from(visualizer.endpoints)) {
      visualizer.channels.push({
        eventType: 'channel',
        eventName: endpoint.event.replace('channel-', ''),
        display: endpoint.desc
      })
    }
    delete visualizer.endpoints
  }

  if (visualizer.components) {
    return (() => {
      const result = []
      for (const component of Array.from(visualizer.components)) {
        const split = component.event.split('-')
        if (split.length > 1) {
          component.eventType = split[0]
          component.eventName = split[1]
        } else {
          component.eventType = 'channel'
          component.eventName = component.event
        }
        component.display = component.desc
        delete component.event
        result.push(delete component.desc)
      }
      return result
    })()
  }
}

upgradeFuncs.push({
  description: 'Migrate visualizer setting from a user\'s profile to a shared collection',
  func () {
    const defer = Q.defer()
    UserModel.find((err, users) => {
      if (err) {
        return Q.defer().reject(err)
      }

      const visNames = []
      const promises = []
      users.forEach((user) => {
        if ((user.settings != null ? user.settings.visualizer : undefined) != null) {
          let vis = user.settings.visualizer
          if (((vis.components != null ? vis.components.length : undefined) > 0) || ((vis.mediators != null ? vis.mediators.length : undefined) > 0) || ((vis.channels != null ? vis.channels.length : undefined) > 0) || ((vis.endpoints != null ? vis.endpoints.length : undefined) > 0)) {
            const userDefer = Q.defer()
            promises.push(userDefer.promise)

            if (vis.endpoints) { // old version
              adaptOldVisualizerStructure(vis)
            }

            let name = `${user.firstname} ${user.surname}'s visualizer`
            name = dedupName(name, visNames)
            vis.name = name
            visNames.push(name)

            vis = new VisualizerModel(vis)
            logger.debug(`Migrating visualizer from user profile ${user.email}, using visualizer name '${name}'`)
            vis.save((err, vis) => {
              if (err) {
                logger.error(`Error migrating visualizer from user profile ${user.email}: ${err.stack}`)
                return userDefer.reject(err)
              }

              // delete the visualizer settings from this user profile
              user.set('settings.visualizer', null)
              user.save((err, user) => {
                if (err) { return userDefer.reject(err) }
                return userDefer.resolve()
              })
            })
          }
        }
      })

      Q.all(promises).then(() => defer.resolve()).catch(err => defer.reject(err))
    })

    return defer.promise
  }
})

if (process.env.NODE_ENV === 'test') {
  exports.upgradeFuncs = upgradeFuncs
  exports.dedupName = dedupName
}

async function upgradeDbInternal () {
  try {
    const dbVer = (await DbVersionModel.findOne()) || new DbVersionModel({version: 0, lastUpdated: new Date()})
    const upgradeFuncsToRun = upgradeFuncs.slice(dbVer.version)

    for (const upgradeFunc of upgradeFuncsToRun) {
      await upgradeFunc.func()
      dbVer.version++
      dbVer.lastUpdated = new Date()
      await dbVer.save()
    }

    if (upgradeFuncsToRun.length === 0) {
      logger.info('No database upgrades needed')
    } else {
      logger.info('Completed database upgrade')
    }
  } catch (err) {
    logger.error(`There was an error upgrading your database, you will need to fix this manually to continue. ${err.stack}`)
  }
}

export function upgradeDb (callback) {
  return upgradeDbInternal()
    .then((...values) => {
      if (callback) {
        callback(null, ...(values || []))
      }
    })
    .catch(err => {
      if (callback) {
        callback(err)
      }
    })
}

if (!module.parent) {
  exports.upgradeDb(() => process.exit())
}
