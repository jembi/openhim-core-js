User = require('../model/users').User
crypto = require 'crypto'
logger = require 'winston'
config = require "../config/config"
config.api = config.get('api')

isUndefOrEmpty = (string) ->
  return not string? or string is ''

exports.authenticate = (next) ->

  header = this.request.header
  email = header['auth-username']
  authTS = header['auth-ts']
  authSalt = header['auth-salt']
  authToken = header['auth-token']

  # if any of the required headers aren't present
  if isUndefOrEmpty(email) or isUndefOrEmpty(authTS) or isUndefOrEmpty(authSalt) or isUndefOrEmpty(authToken)
    logger.info "API request made by #{email} from #{this.request.host} is missing required API authentication headers, denying access"
    this.status = 401
    return

  # check if request is recent
  requestDate = new Date Date.parse authTS

  authWindowSeconds = config.api.authWindowSeconds ? 10
  to = new Date()
  to.setSeconds(to.getSeconds() + authWindowSeconds)
  from = new Date()
  from.setSeconds(from.getSeconds() - authWindowSeconds)

  if requestDate < from or requestDate > to
    # request expired
    logger.info "API request made by #{email} from #{this.request.host} has expired, denying access"
    this.status = 401
    return

  user = yield User.findOne(email: email).exec()
  this.authenticated = user

  if not user
    # not authenticated - user not found
    logger.info "No user exists for #{email}, denying access to API, request originated from #{this.request.host}"
    this.status = 401
    return

  hash = crypto.createHash 'sha512'
  hash.update user.passwordHash
  hash.update authSalt
  hash.update authTS

  if authToken is hash.digest 'hex'
    # authenticated
    yield next
  else
    # not authenticated - token mismatch
    logger.info "API token did not match expected value, denying access to API, the request was made by #{email} from #{this.request.host}"
    this.status = 401
