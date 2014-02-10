MongoClient = require('mongodb').MongoClient;

exports.storeRequest = (req, res, next) ->
	console.log "store request"
	next()

exports.storeResponse = (req, res, next) ->
	console.log "store response"
	next()

