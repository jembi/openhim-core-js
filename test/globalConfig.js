// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
require('source-map-support').install({handleUncaughtExceptions: false});
import mongoose from 'mongoose';
import config from "../config/test.json";

global.testTimeoutFactor = 1;

if (process.env.TRAVIS === 'true') {
  global.testTimeoutFactor = 12;
}

let dropTestDb = function(done) {
  // ensure that we can only drop the test database
  if (config.mongo.url.indexOf('openhim-test') > -1) {
    process.stdout.write('Dropping test database...');
    // drop test database when starting tests
    return mongoose.connect(config.mongo.url, () =>
      mongoose.connection.db.dropDatabase(function(err, result) {
        if (err != null) { throw err; }
        if (result) {
          console.log('Success');
        } else {
          console.log('Failed');
        }
        return done();
      })
    );
  }
};

before(done => dropTestDb(done));

after(done => dropTestDb(done));
