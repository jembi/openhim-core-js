Channel = require("../model/channels").Channel
Transaction = require("../model/transactions").Transaction
Q = require "q"
logger = require "winston"

exports.authorise = (ctx, done) ->
	Channel.find {}, (err, channels) ->
		for channel in channels
			pat = new RegExp channel.urlPattern
			if pat.test ctx.request.url
				matchedRoles = channel.allow.filter (element) ->
					return (ctx.authenticated.roles.indexOf element) isnt -1
				if matchedRoles.length > 0 or (channel.allow.indexOf ctx.authenticated.clientID) isnt -1
					# authorisation success
					ctx.authorisedChannel = channel
					logger.info "The request, '" + ctx.request.url + "' is authorised to access " + ctx.authorisedChannel.name

					# update transaction with the authroised channel - async
					Transaction.findOneAndUpdate { _id: ctx.transactionId }, { channelID: channel._id }, ->

					return done()

		# authorisation failed
		ctx.response.status = "unauthorized"
		logger.info "The request, '" + ctx.request.url + "', is not authorised to access any channels."
		return done()

exports.koaMiddleware = `function *authorisationMiddleware(next) {
		var authorise = Q.denodeify(exports.authorise);
		yield authorise(this);
		if (this.authorisedChannel) {
			yield next;
		}
	}`
