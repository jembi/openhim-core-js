'use strict'

import logger from 'winston'
import pem from 'pem'

import {ClientModel} from './model/clients'
import {DbVersionModel} from './model/dbVersion'
import {KeystoreModel} from './model/keystore'
import {UserModel} from './model/users'
import {VisualizerModel} from './model/visualizer'
import {
  TransactionModel,
  compactTransactionCollection
} from './model/transactions'
import {extractTransactionPayloadIntoChunks} from './contentChunk'
import {makeQuerablePromise} from './utils'

function dedupName(name, names, num) {
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
  func() {
    return new Promise((resolve, reject) => {
      KeystoreModel.findOne((err, keystore) => {
        if (err) {
          return reject(err)
        }
        if (!keystore) {
          return resolve()
        }

        // convert server cert
        pem.getFingerprint(keystore.cert.data, (err, obj) => {
          if (err) {
            return reject(err)
          }
          keystore.cert.fingerprint = obj.fingerprint

          const promises = keystore.ca.map(cert => {
            return new Promise((resolve, reject) => {
              pem.getFingerprint(cert.data, (err, obj) => {
                if (err) {
                  return reject(err)
                }
                cert.fingerprint = obj.fingerprint
                return resolve()
              })
            })
          })

          Promise.all(promises)
            .then(() =>
              keystore.save(err => {
                if (err != null) {
                  logger.error(`Failed to save keystore: ${err}`)
                }
                return resolve()
              })
            )
            .catch(reject)
        })
      })
    })
  }
})

upgradeFuncs.push({
  description:
    'Convert clients link to certs via their domain to use the cert fingerprint instead',
  func() {
    return new Promise((resolve, reject) => {
      ClientModel.find((err, clients) => {
        if (err != null) {
          logger.error(`Couldn't fetch all clients to upgrade db: ${err}`)
          return reject(err)
        }

        return KeystoreModel.findOne((err, keystore) => {
          if (err != null) {
            logger.error(`Couldn't fetch keystore to upgrade db: ${err}`)
            return reject(err)
          }

          const promises = []

          Array.from(clients).forEach(client => {
            if (keystore != null && keystore.ca != null) {
              for (const cert of Array.from(keystore.ca)) {
                if (
                  client.clientDomain === cert.commonName &&
                  client.certFingerprint == null
                ) {
                  client.certFingerprint = cert.fingerprint
                  break
                }
              }
              promises.push(client.save())
            }
          })

          return Promise.all(promises).then(resolve).catch(reject)
        })
      })
    })
  }
})

// Adapt visualizer from an old version (core 2.0.0, console 1.6.0 and earlier)
//
// We follow the same migration strategy as console:
// https://github.com/jembi/openhim-console/blob/1047b49db2050bafa6b4797e3788fa716d1760b3/app/scripts/controllers/profile.js#L83-L109
function adaptOldVisualizerStructure(visualizer) {
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
  description:
    "Migrate visualizer setting from a user's profile to a shared collection",
  func() {
    return new Promise((resolve, reject) => {
      UserModel.find((err, users) => {
        if (err) {
          return reject(err)
        }

        const visNames = []
        const promises = []
        users.forEach(user => {
          if (
            (user.settings != null ? user.settings.visualizer : undefined) !=
            null
          ) {
            let vis = user.settings.visualizer
            if (
              (vis.components != null ? vis.components.length : undefined) >
                0 ||
              (vis.mediators != null ? vis.mediators.length : undefined) > 0 ||
              (vis.channels != null ? vis.channels.length : undefined) > 0 ||
              (vis.endpoints != null ? vis.endpoints.length : undefined) > 0
            ) {
              const promise = new Promise((resolve, reject) => {
                if (vis.endpoints) {
                  // old version
                  adaptOldVisualizerStructure(vis)
                }

                let name = `${user.firstname} ${user.surname}'s visualizer`
                name = dedupName(name, visNames)
                vis.name = name
                visNames.push(name)

                vis = new VisualizerModel(vis)
                logger.debug(
                  `Migrating visualizer from user profile ${user.email}, using visualizer name '${name}'`
                )
                vis.save(err => {
                  if (err) {
                    logger.error(
                      `Error migrating visualizer from user profile ${user.email}: ${err.stack}`
                    )
                    return reject(err)
                  }

                  // delete the visualizer settings from this user profile
                  user.set('settings.visualizer', null)
                  user.save(err => {
                    if (err) {
                      return reject(err)
                    }
                    return resolve()
                  })
                })
              })
              promises.push(promise)
            }
          }
        })

        return Promise.all(promises)
          .then(() => resolve())
          .catch(err => reject(err))
      })
    })
  }
})

async function processTransaction(transaction) {
  const rawTransaction = transaction.toObject()
  await extractTransactionPayloadIntoChunks(rawTransaction)
  await TransactionModel.replaceOne(
    {_id: rawTransaction._id},
    rawTransaction
  ).exec()
}

upgradeFuncs.push({
  description: 'Migrate transaction bodies to GridFS',
  async func(batchSize = 100, concurrency = 5) {
    const totalTransactions = await TransactionModel.countDocuments().exec()
    let batchNum = 0
    const currentlyExecuting = []
    const totalBatches = Math.ceil(totalTransactions / batchSize)
    const startTime = new Date()

    logger.info(
      `Migrating ${totalTransactions} to GridFS in batches of ${batchSize}`
    )
    logger.info(`Using concurrency of ${concurrency}`)

    do {
      batchNum += 1
      const transactions = await TransactionModel.find()
        .skip(batchSize * (batchNum - 1))
        .limit(batchSize)
        .exec()
      for (const transaction of transactions) {
        logger.info(
          `Batch [${batchNum}/${totalBatches}]: Processing transaction ${transaction._id}`
        )

        const promise = makeQuerablePromise(processTransaction(transaction))
        promise.catch(err => {
          logger.error(
            `Error migrating transaction with ID: ${transaction._id}`
          )
          throw err
        })

        currentlyExecuting.push(promise)

        if (currentlyExecuting.length === concurrency) {
          // wait for at least one promise to settle
          await Promise.race(currentlyExecuting)
          for (const [i, promise] of currentlyExecuting.entries()) {
            if (promise.isSettled()) {
              currentlyExecuting.splice(i, 1)
            }
          }
        }
      }
      logger.debug('Compacting Transactions Collection...')
      await compactTransactionCollection()
    } while (totalTransactions > batchSize * batchNum)

    // wait for remaining transaction to process
    await Promise.all(currentlyExecuting)

    const endTime = new Date()
    logger.info(`GridFS migration took ${endTime - startTime}ms`)
  }
})

if (process.env.NODE_ENV === 'test') {
  exports.upgradeFuncs = upgradeFuncs
  exports.dedupName = dedupName
}

async function upgradeDbInternal() {
  try {
    const dbVer =
      (await DbVersionModel.findOne()) ||
      new DbVersionModel({version: 0, lastUpdated: new Date()})
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
    logger.error(
      `There was an error upgrading your database, you will need to fix this manually to continue. ${err.stack}`
    )
    process.exit()
  }
}

export function upgradeDb(callback) {
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
