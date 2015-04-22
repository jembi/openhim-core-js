require('source-map-support').install handleUncaughtExceptions: false
mongoose = require 'mongoose'
config = require "../config/test.json"

dropTestDb = (done) ->
  # ensure that we can only drop the test database
  if config.mongo.url.indexOf('openhim-test') > -1
    process.stdout.write 'Dropping test database...'
    # drop test database when starting tests
    mongoose.connect config.mongo.url, ->
      mongoose.connection.db.dropDatabase (err, result) ->
        throw err if err?
        if result
          console.log 'Success'
        else
          console.log 'Failed'
        done()

before (done) -> dropTestDb done

after (done) -> dropTestDb done
