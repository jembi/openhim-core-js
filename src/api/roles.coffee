Channel = require('../model/channels').Channel
Client = require('../model/clients').Client
logger = require 'winston'
authorisation = require './authorisation'
utils = require '../utils'


###
# Roles is a virtual API; virtual in the sense that it is not linked
# to a concrete roles collection.
#
# Rather it an abstraction of the 'allowed' field on Channels,
# providing a mechanism for setting up allowed permissions.
###


filterRolesFromChannels = (channels, allClients) ->
  roles = {}
  for ch in channels
    for permission in ch.allow
      isClient = false
      for cl in allClients
        if cl.clientID is permission
          isClient = true

      if not isClient
        if not roles[permission] then roles[permission] = channels: []
        roles[permission].channels.push _id: ch._id, name: ch.name

  rolesArray = []
  for role of roles
    rolesArray.push
      name: role
      channels: roles[role].channels

  return rolesArray


exports.getRoles = ->
  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getRoles denied.", 'info'
    return

  try
    channels = yield Channel.find({}, {'name': 1, 'allow': 1 }).exec()
    clients = yield Client.find({}, {'clientID': 1 }).exec()

    this.body = filterRolesFromChannels channels, clients
  catch e
    logger.error "Could not fetch roles via the API: #{e.message}"
    this.message = e.message
    this.status = 500


exports.getRole = (name) ->
  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getRole denied.", 'info'
    return

  try
    result = yield Channel.find({'allowed': {'$in': name}}, {'_id': 1 }).exec()
    if result is null
      utils.logAndSetResponse this, 404, "Role with name '#{name}' could not be found.", 'info'
    else
      this.body =
        name: name
        channels: result.map (r) -> "#{r._id}"
  catch e
    logger.error "Could not find role with name '#{name}' via the API: #{e.message}"
    this.body = e.message
    this.status = 500


exports.addRole = ->
  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to addRole denied.", 'info'
    return

  role = this.request.body
  if not role.name
    utils.logAndSetResponse this, 400, 'Must specify a role name', 'info'
  if not role.channels or role.channels.length is 0
    utils.logAndSetResponse this, 400, 'Must specify at least one channel to link the role to', 'info'

  try
    logger.info "User #{this.authenticated.email} setup role '#{role.name}'"
    this.body = 'Role successfully created'
    this.status = 201
  catch e
    logger.error "Could not add a role via the API: #{e.message}"
    this.body = e.message
    this.status = 400


exports.updateRole = (name) ->
  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to updateRole denied.", 'info'
    return

  role = this.request.body

  try
    logger.info "User #{this.authenticated.email} updated role with name '#{name}'"
    this.body = 'Successfully updated role'
  catch e
    logger.error "Could not update role with name '#{name}' via the API: #{e.message}"
    this.body = e.message
    this.status = 500
