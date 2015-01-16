#!/usr/bin/env node
var forever = require('forever-monitor');
var path = require('path');
var fs   = require('fs');

var args = process.argv;
args.splice(0,2);
console.log(args);

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
