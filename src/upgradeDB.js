'use strict'

import logger from 'winston'
import pem from 'pem'

import {ClientModel} from './model/clients'
import {DbVersionModel} from './model/dbVersion'
import {KeystoreModel} from './model/keystore'
import {UserModel} from './model/users'
import {VisualizerModel} from './model/visualizer'
import {PassportModel} from './model/passport'
import {RoleModel, roles} from './model/role'
import {ChannelModel} from './model/channels'

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

        KeystoreModel.findOne((err, keystore) => {
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

          Promise.all(promises).then(resolve).catch(reject)
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

        Promise.all(promises)
          .then(() => resolve())
          .catch(err => reject(err))
      })
    })
  }
})

upgradeFuncs.push({
  description:
    'Migrate password properties of token auth strategy from User collection to Passport collection',
  func() {
    return new Promise((resolve, reject) => {
      UserModel.find((err, users) => {
        if (err) {
          return reject(err)
        }

        const promises = []
        users.forEach(user => {
          if (
            user.passwordHash != null &&
            user.passwordAlgorithm != null &&
            user.passwordSalt != null
          ) {
            let pass = {
              passwordHash: user.passwordHash,
              passwordAlgorithm: user.passwordAlgorithm,
              passwordSalt: user.passwordSalt,
              email: user.email,
              protocol: 'token'
            }

            const promise = new Promise((resolve, reject) => {
              pass = new PassportModel(pass)
              logger.debug(
                `Migrating passwords fields from user ${user.email} to passport collection`
              )
              pass.save(err => {
                if (err) {
                  logger.error(
                    `Error migrating password fields from user ${user.email}: ${err.stack}`
                  )
                  return reject(err)
                }

                // delete the password fields from this user
                user.set('passwordHash', null)
                user.set('passwordAlgorithm', null)
                user.set('passwordSalt', null)
                // add the field provider to know that these users are from old version
                user.set('provider', 'token')
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
        })

        Promise.all(promises)
          .then(() => resolve())
          .catch(err => reject(err))
      })
    })
  }
})

upgradeFuncs.push({
  description: 'Create default roles with permissions and update user groups',
  func: async () => {
    try {
      const channels = await ChannelModel.find()
      const existingRoles = JSON.parse(JSON.stringify(roles)) // Deep clone the roles object

      const updateRolePermissions = (role, permissionType, channelName) => {
        if (!existingRoles[role]) {
          existingRoles[role] = { permissions: {} }
        }
        if (!existingRoles[role].permissions[permissionType]) {
          existingRoles[role].permissions[permissionType] = []
        }
        existingRoles[role].permissions[permissionType].push(channelName)
        existingRoles[role].permissions['channel-view-specified'] = existingRoles[role].permissions['channel-view-specified'] || []
        existingRoles[role].permissions['channel-view-specified'].push(channelName)
        existingRoles[role].permissions['client-view-all'] = true
      }

      channels.forEach(channel => {
        if (Array.isArray(channel.allow)) {
          const aclTypes = [
            { acl: channel.txViewAcl, permissionType: 'transaction-view-specified' },
            { acl: channel.txRerunAcl, permissionType: 'transaction-rerun-specified' },
            { acl: channel.txViewFullAcl, permissionType: 'transaction-view-body-specified' }
          ]

          aclTypes.forEach(({ acl, permissionType }) => {
            if (acl && acl.length > 0) {
              acl.forEach(role => updateRolePermissions(role, permissionType, channel.name))
            }
          })
        }
      })

      // Create or update roles
      await Promise.all(Object.entries(existingRoles).map(([roleName, roleData]) =>
        RoleModel.findOneAndUpdate(
          { name: roleName },
          { name: roleName, permissions: roleData.permissions },
          { upsert: true, new: true }
        )
      ))

      logger.info('Successfully updated roles')
    } catch (err) {
      logger.error(`Error updating roles: ${err}`)
      throw err
    }
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
