require('source-map-support').install handleUncaughtExceptions: false
mongoose = require 'mongoose'
config = require "../config/test.json"

global.testTimeoutFactor = 1

if process.env.TRAVIS is 'true'
  global.testTimeoutFactor = 12 # this can be changed to 20  once we have mocha test timeouts of greater than 3s on travis

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
