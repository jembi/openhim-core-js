auth = require 'basic-auth'
Q = require "q"
Client = require("../model/clients").Client
logger = require "winston"
crypto = require "crypto"

exports.authenticateUser = (ctx, done) ->

  Client.findOne { _id: ctx.request.header.clientid }, (err, client) ->
    ctx.authenticated = client
    ctx.parentID = ctx.request.header.parentid
    ctx.taskID = ctx.request.header.taskid
    done null, client
  

###
# Koa middleware for authentication by basic auth
###
exports.koaMiddleware = (next) ->
  authenticateUser = Q.denodeify exports.authenticateUser
  yield authenticateUser this

  if this.authenticated?
    yield next
  else
    this.authenticated =
      ip : '127.0.0.1'
    # This is a public channel, allow rerun
    yield next

