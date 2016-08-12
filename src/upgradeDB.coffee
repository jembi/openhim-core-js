dbVersion = require('./model/dbVersion').dbVersion
Keystore = require('./model/keystore').Keystore
Client = require('./model/clients').Client
User = require('./model/users').User
Visualizer = require('./model/visualizer').Visualizer
logger = require 'winston'
pem = require 'pem'
Q = require 'q'

dedupName = (name, names, num) ->
  if num
    newName = "#{name} #{num}"
  else
    newName = name
  if newName in names
    if not num
      num = 1
    return dedupName(name, names, ++num)
  else
    return newName

# push new upgrade functions to this array, function must return a promise
# Warning: only add new function below existing functions, order matters!
upgradeFuncs = []

upgradeFuncs.push
  description: "Ensure that all certs have a fingerprint property"
  func: ->
    defer = Q.defer()

    Keystore.findOne (err, keystore) ->
      return defer.resolve() if not keystore

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

    Client.find (err, clients) ->
      if err?
        logger.error "Couldn't fetch all clients to upgrade db: #{err}"
        return defer.reject()

      Keystore.findOne (err, keystore) ->
        if err?
          logger.error "Couldn't fetch keystore to upgrade db: #{err}"
          return defer.reject()

        promises = []
        for client in clients
          clientDefer = Q.defer()
          promises.push clientDefer.promise

          if keystore?.ca?
            for cert in keystore.ca
              if client.clientDomain is cert.commonName and not client.certFingerprint?
                client.certFingerprint = cert.fingerprint
                break

          do (clientDefer) ->
            client.save (err) ->
              if err?
                logger.error "Couldn't save client #{client.clientID} while upgrading db: #{err}"
                return clientDefer.reject()

              clientDefer.resolve()

        Q.all(promises).then ->
          defer.resolve()

    return defer.promise

upgradeFuncs.push
  description: "Migrate visualizer setting from a user's profile to a shared collection"
  func: ->
    defer = Q.defer()
    User.find (err, users) ->
      if err
        return Q.defer().reject(err)

      visNames = []
      promises = []
      users.forEach (user) ->
        if user.settings?.visualizer?
          userDefer = Q.defer()
          promises.push userDefer.promise

          vis = user.settings.visualizer
          name = "#{user.firstname} #{user.surname}'s visualizer"
          name = dedupName name, visNames
          vis.name = name
          visNames.push name

          vis = new Visualizer vis
          logger.debug "Migrating visualizer from user profile #{user.email}, using viualizer name '#{name}'"
          vis.save (err, vis) ->
            if err
              logger.error "Error migrating visualizer from user profile #{user.email}: #{err.stack}"
              return userDefer.reject err

            # delete the visualizer settings from this user profile
            user.set 'settings.visualizer', null
            user.save (err, user) ->
              if err then return userDefer.reject err
              return userDefer.resolve()

      Q.all(promises).then ->
        defer.resolve()
      .catch (err) ->
        defer.reject err

    return defer.promise

# add new upgrade functions here ^^

runUpgradeFunc = (i, dbVer) ->
  logger.info "  \u2022 Running update: #{upgradeFuncs[i].description}..."
  defer = Q.defer()
  # run upgrade function
  upgradeFuncs[i].func().then ->
    # update the datbase version
    dbVer.version = i
    dbVer.lastUpdated = new Date()
    dbVer.save (err) ->
      logger.error err if err?
      logger.info "  \u2713 Done."
      defer.resolve()
  .catch (err) ->
    defer.reject err
  return defer.promise

if process.env.NODE_ENV == "test"
  exports.upgradeFuncs = upgradeFuncs
  exports.runUpgradeFunc = runUpgradeFunc
  exports.dedupName = dedupName

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
      # call each database upgrade function sequentially
      for i in [(dbVer.version + 1)..(upgradeFuncs.length - 1)]
        do (i) ->
          if not promise?
            promise = runUpgradeFunc(i, dbVer)
          else
            promise = promise.then -> runUpgradeFunc(i, dbVer)

      promise.then ->
        logger.info 'Completed database upgrade'
        callback()
      .catch (err) ->
        logger.error "There was an error upgrading your database, you will need to fix this manually to continue. #{err.stack}"
        process.exit()
    else
      logger.info 'No database upgrades needed'
      callback()

if not module.parent
  exports.upgradeDb(-> process.exit())
