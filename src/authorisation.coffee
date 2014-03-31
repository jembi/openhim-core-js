router = require "./router"
Q = require "q"
logger = require "winston"

exports.authorise = (ctx, done) ->
	ctx.authorisedChannels = []
	router.getChannels (err, channels) ->
		for channel in channels
			pat = new RegExp channel.urlPattern
			if pat.test ctx.request.url
				matchedRoles = channel.allow.filter (element) ->
					return (ctx.authenticated.roles.indexOf element) isnt -1
				if matchedRoles.length > 0 or (channel.allow.indexOf ctx.authenticated.applicationID) isnt -1
					# authorisation success
					ctx.authorisedChannels.push channel
					logger.info "The request, '" + ctx.request.url + "' is authorised to access " + ctx.authorisedChannels.length + " channels.", ctx.authorisedChannels
		if ctx.authorisedChannels.length < 1
			# authorisation failed
			ctx.response.status = "unauthorized"
			logger.info "The request, '" + ctx.request.url + "', is not authorised to access any channels"
		done()

exports.koaMiddleware = `function *authorisationMiddleware(next) {
		var authorise = Q.denodeify(exports.authorise);
		yield authorise(this);
		if (this.authorisedChannels.length > 0) {
			yield next;
		}
	}`