events = require '../model/events'


exports.getLatestEvents = `function *getLatestEvents(receivedTime) {
  var rtDate = new Date(Number(receivedTime));
  var result = yield events.VisualizerEvent.find({ 'created': { '$gte': rtDate } }).sort({ 'ts': 1 }).exec()
  this.body = { events: result };
}`

exports.sync = `function *sync() {
  this.body = { now: Date.now() };
}`
