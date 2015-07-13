#!/usr/bin/env node
var forever = require('forever-monitor');
var path = require('path');
var fs   = require('fs');

var args = process.argv;
args.splice(0,2);


/* Check for version flag */

if (args.indexOf('-v') >= 0 || args.indexOf('--version') >= 0) {
  var pkgF = path.join(path.dirname(fs.realpathSync(__filename)), '../package.json');
  var pkg = JSON.parse(fs.readFileSync(pkgF));
  console.log("OpenHIM Core version " + pkg.version);
  process.exit(0);
}


var lib  = path.join(path.dirname(fs.realpathSync(__filename)), '../lib');

var child = new (forever.Monitor)('server.js', {
  sourceDir: lib,
  command: 'node --harmony',
  args: args,
  watch: true
});

child.on('watch:restart', function(info) {
    console.error('Restaring script because ' + info.file + ' changed');
});

child.on('restart', function() {
    console.error('Forever restarting script for ' + child.times + ' time');
});

child.on('exit:code', function(code) {
    console.error('Forever detected script exited with code ' + code);
});

child.start();
