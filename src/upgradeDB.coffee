dbVersion = require('./model/dbVersion').dbVersion
logger = require 'winston'
Q = require 'q'

# push new upgrade functions to this array
# Warning: only add new function below existing functions, order matters!
upgradeFuncs = []

upgradeFuncs.push
  description: "Upgrade some stuff"
  func: ->
    defer = Q.defer()
    # do some stuff
    setTimeout ->
      console.log('did stuff')
      defer.resolve()
    , 500
    return defer.promise

upgradeFuncs.push
  description: "Upgrade some more stuff"
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
