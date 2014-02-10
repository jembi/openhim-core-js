http = require 'http'

exports.route = (req, res, next) ->
	console.log "route message and set response"

	next()