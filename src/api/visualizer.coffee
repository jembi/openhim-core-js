Q = require 'q'
moment = require 'moment'
logger = require 'winston'
config = require '../config/config'
events = require '../model/events'
messageStore = require '../middleware/messageStore'

exports.storeVisualizerEvents = (ctx, done) ->
	logger.info "Storing visualizer events for transaction: #{ctx.transactionId}"
	trxEvents = []
	#TODO not timezone friendly
	formatTS = (ts) -> moment(ts).format('YYYYMMDDHHmmssSSS')

	# Transaction start for channal
	trxEvents.push new events.VisualizerEvent
		ts: formatTS ctx.requestTimestamp
		comp: "channel-#{ctx.authorisedChannel.name}"
		ev: 'start'
	# Transaction start for primary route
	trxEvents.push new events.VisualizerEvent
		ts: formatTS ctx.requestTimestamp
		comp: ctx.authorisedChannel.name
		ev: 'start'

	if ctx.routes
		for route in ctx.routes
			# Transaction start for route
			trxEvents.push new events.VisualizerEvent
				ts: formatTS route.request.timestamp
				comp: "route-#{route.name}"
				ev: 'start'

			#TODO more comprehensive status
			routeStatus = 'ok'
			if 500 <= route.response.status <= 599
				routeStatus = 'error'
			# Transaction end for route
			trxEvents.push new events.VisualizerEvent
				ts: formatTS route.response.timestamp
				comp: "route-#{route.name}"
				ev: 'end'
				status: routeStatus

	#TODO more comprehensive status
	status = 'ok'
	if ctx.transactionStatus is messageStore.transactionStatus.FAILED
		status = 'error'

	# Transaction end for primary route
	trxEvents.push new events.VisualizerEvent
		ts: formatTS ctx.response.timestamp
		comp: ctx.authorisedChannel.name
		ev: 'end'
		status: status
	# Transaction end for channal
	trxEvents.push new events.VisualizerEvent
		ts: formatTS ctx.response.timestamp
		comp: "channel-#{ctx.authorisedChannel.name}"
		ev: 'end'
		status: status

	events.VisualizerEvent.create trxEvents, (err) -> return if err then done err else done()

exports.getLatestEvents = `function *getLatestEvents(receivedTime) {
	var rtDate = new Date(Number(receivedTime));
	var result = yield events.VisualizerEvent.find({ 'created': { '$gte': rtDate } }).sort({ 'ts': 1 }).exec()
	this.body = { events: result };
}`

# TODO API authentication already returns the server time
exports.sync = `function *sync() {
	this.body = { now: Date.now() };
}`
