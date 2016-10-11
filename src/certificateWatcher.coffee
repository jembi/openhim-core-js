logger = require "winston"
moment = require 'moment'
chokidar = require 'chokidar'
server = require "./server"

restartTheServer = (agenda, job, done) ->
  server.startRestartServerTimeout ->
    logger.info 'Proceeding to restart servers...'

setupAgenda = (agenda, certificateManagement) ->
  # cancel any existing agenda job from previous restarts
  agenda.cancel { name: 'restart the server' }, (err, numRemoved) ->
    logger.info 'Agenda - Server restart job removed'

  #define agenda job to execute
  agenda.define 'restart the server', (job, done) -> restartTheServer agenda, job, done

  certFile = certificateManagement.certPath
  keyFile = certificateManagement.keyPath
  paths = [certFile, keyFile]
  watcher = chokidar.watch(paths, {
    usePolling: true,
    interval: 10000,
  }).on('ready', ->
    logger.info 'Certificate/Key watch paths:', watcher.getWatched()

    watcher.on 'change', (path, stats) ->
      if stats
        # every - ensure only single job is created
        agenda.every '1 minutes', 'restart the server', null, ->
          logger.info 'Certificate/Key has been updated, restart the server'
      return
  )

exports.setupAgenda = setupAgenda

if process.env.NODE_ENV is "test"
  exports.restartTheServer = restartTheServer
