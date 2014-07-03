auth = require 'basic-auth'
Q = require "q"
Client = require("../model/clients").Client
logger = require "winston"
crypto = require "crypto"

exports.authenticateUser = (ctx, done) ->
	
	console.log(ctx)

	###
	ctxObject = ctx
	ctx = new Object()
	ctx.path = ctxObject.path
	ctx.header = ctxObject.header

	if ctxObject.header.querystring
		ctx.querystring = ctxObject.header.querystring
	if ctxObject.header.body
		ctx.body = ctxObject.header.body
	ctx.method = ctxObject.method

	ctx.request = new Object()
	ctx.request.url = ctxObject.path
	ctx.request.method = ctxObject.method

	if ctxObject.header.querystring
		ctx.request.querystring = ctxObject.header.querystring

	ctx.response = new Object()
	ctx.status = "Processing"
	
	console.log(ctx)
	###

	console.log(clientID: ctx.request.header.clientid)
	Client.findOne { clientID: ctx.request.header.clientid }, (err, client) ->
		ctx.authenticated = client
		ctx.parentID = ctx.request.header.parentid
		done null, client
	

###
# Koa middleware for authentication by basic auth
###
exports.koaMiddleware = `function *rerunBypassAuthMiddleware(next) {
	
	var authenticateUser = Q.denodeify(exports.authenticateUser);
	yield authenticateUser(this);

	if (this.authenticated) {
		yield next;
	} else {
		this.response.status = "unauthorized";
	}
	
}`
