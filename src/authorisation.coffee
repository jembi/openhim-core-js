router = require "../lib/router"

exports.authorise = (ctx, done) ->
	router.getChannels (err, channels) ->
		for channel in channels
			pat = new RegExp channel.urlPattern
			if pat.test ctx.request.url
				matchedRoles = channel.allow.filter (element) ->
					console.log "App Roles: " + JSON.stringify ctx.authenticated.roles
					console.log "Element: " + element
					return ctx.authenticated.roles.indexOf element != -1
				console.log "MatchedRoles Length: " + matchedRoles.length
				console.log "matchedroles: " + JSON.stringify matchedRoles
				if matchedRoles.length < 0 and channel.allow.indexOf ctx.authenticated.applicationID == -1
					# authorisation failed
					ctx.authorised = false
					# set 401 response
					ctx.response.code = "unauthorized"
					done()
				else
					# authorisation success
					ctx.authorised = true
					done()

exports.koaMiddleware = `function *authorisationMiddleware(next) {
		var authorise = Q.denodeify(exports.authorise);
		yield authorise(this);
		if (this.authorised) {
			yield next;	
		}
	}`