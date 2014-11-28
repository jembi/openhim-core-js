SDC = require "statsd-client"
sdc = new SDC { host: '104.236.15.32' }

exports.koaMiddleware = `function *statsMiddleware(next) {

      var timer = new Date();
      yield next;
      sdc.increment('some.counter'); // Increment by one.
      sdc.gauge('some.gauge', 10); // Set gauge to 10
      sdc.timing('some.timer', timer); // Calculates time diff
      sdc.close();
}`