dbVersion = require('./model/dbVersion').dbVersion
Keystore = require('./model/keystore').Keystore
logger = require 'winston'
pem = require 'pem'
Q = require 'q'

# push new upgrade functions to this array
# Warning: only add new function below existing functions, order matters!
upgradeFuncs = []

upgradeFuncs.push
  description: "Ensure that all certs have a fingerprint property"
  func: ->
    defer = Q.defer()
    
    Keystore.findOne (err, keystore) ->
      # convert server cert
      pem.getFingerprint keystore.cert.data, (err, obj) ->
        keystore.cert.fingerprint = obj.fingerprint

        promises = []
        for cert, i in keystore.ca
          caDefer = Q.defer()
          promises.push caDefer.promise
          do (caDefer, i) ->
            pem.getFingerprint cert.data, (err, obj) ->
              keystore.ca[i].fingerprint = obj.fingerprint
              caDefer.resolve()

        Q.all(promises).then ->
          keystore.save (err) ->
            logger.error "Failed to save keystore: #{err}" if err?
            defer.resolve()

    return defer.promise

upgradeFuncs.push
  description: "Convert clients link to certs via their domain to use the cert fingerprint instead"
  func: ->
    defer = Q.defer()
    # do some more stuff
    setTimeout ->
      console.log('did more stuff')
      defer.resolve()
    , 2000
    return defer.promise

# add new upgrade functions here

runUpgradeFunc = (i, dbVer) ->
  logger.info "  Running update: #{upgradeFuncs[i].description}..."
  defer = Q.defer()
  # run upgrade function
  upgradeFuncs[i].func().then ->
    # update the datbase version
    dbVer.version = i
    dbVer.lastUpdated = new Date()
    dbVer.save (err) ->
      logger.error err if err?
      logger.info "  Done."
      defer.resolve()
  return defer.promise

exports.upgradeDb = (callback) ->
  dbVersion.findOne (err, dbVer) ->
    if dbVer is null
      dbVer = new dbVersion
        version: -1
        lastUpdated: new Date()

    # check if the database version need to be upgraded
    if dbVer.version < (upgradeFuncs.length - 1)
      logger.info 'Upgrading the database...'
      promise = null
      # call each database upgrade fucntion sequentially
      for i in [(dbVer.version + 1)..(upgradeFuncs.length - 1)]
        do (i) ->
          if not promise?
            promise = runUpgradeFunc(i, dbVer)
          else
            promise = promise.then -> runUpgradeFunc(i, dbVer)

      promise.then ->
        logger.info 'Completed database upgrade'
        callback()
    else
      logger.info 'No database upgrades needed'
      callback()

if not module.parent
  exports.upgradeDb(-> process.exit())
