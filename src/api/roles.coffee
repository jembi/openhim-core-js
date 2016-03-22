Channel = require('../model/channels').Channel
Client = require('../model/clients').Client
logger = require 'winston'
authorisation = require './authorisation'
utils = require '../utils'


###
# Roles is a virtual API; virtual in the sense that it is not linked
# to a concrete roles collection.
#
# Rather it an abstraction of the 'allow' field on Channels and 'roles' on Clients,
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
      clients: ((allClients.filter (cl) -> role in cl.roles).map (fc) -> _id: fc._id, clientID: fc.clientID)

  return rolesArray


exports.getRoles = ->
  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getRoles denied.", 'info'
    return

  try
    channels = yield Channel.find({}, {'name': 1, 'allow': 1 }).exec()
    clients = yield Client.find({}, {'clientID': 1, 'roles': 1 }).exec()

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
    result = yield Channel.find({'allow': {'$in': [name]}}, {'name': 1 }).exec()
    if result is null or result.length is 0
      utils.logAndSetResponse this, 404, "Role with name '#{name}' could not be found.", 'info'
    else
      clients = yield Client.find({ roles: $in: [name]}, {'clientID': 1 }).exec()
      this.body =
        name: name
        channels: result.map (r) -> _id: r._id, name: r.name
        clients: clients.map (c) -> _id: c._id, clientID: c.clientID
  catch e
    logger.error "Could not find role with name '#{name}' via the API: #{e.message}"
    this.body = e.message
    this.status = 500


buildFindChannelByIdOrNameCriteria = (ctx, role) ->
  criteria = {}
  ids = []
  names = []
  for ch in role.channels
    if ch._id
      ids.push ch._id
    else if ch.name
      names.push ch.name
    else
      utils.logAndSetResponse ctx, 400, "_id and/or name must be specified for a channel", 'info'
      return null

  if ids.length > 0 and names.length > 0
    criteria =
      $or: [
          _id: $in: ids
        ,
          name: $in: names
      ]
  else
    if ids.length > 0
      criteria._id = $in: ids
    if names.length > 0
      criteria.name = $in: names

  return criteria

buildFindClientByIdOrClientIDCriteria = (ctx, role) ->
  criteria = {}
  ids = []
  clientIDs = []
  for ch in role.clients
    if ch._id
      ids.push ch._id
    else if ch.clientID
      clientIDs.push ch.clientID
    else
      utils.logAndSetResponse ctx, 400, "_id and/or clientID must be specified for a client", 'info'
      return null

  if ids.length > 0 and clientIDs.length > 0
    criteria =
      $or: [
          _id: $in: ids
        ,
          clientID: $in: clientIDs
      ]
  else
    if ids.length > 0
      criteria._id = $in: ids
    if clientIDs.length > 0
      criteria.clientID = $in: clientIDs

  return criteria


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
    result = yield Channel.find({'allow': {'$in': [role.name]}}, {'name': 1 }).exec()
    if result isnt null and result.length > 0
      return utils.logAndSetResponse this, 400, "Role with name '#{role.name}' already exists.", 'info'

    criteria = buildFindChannelByIdOrNameCriteria this, role
    return if not criteria

    if role.clients
      clCriteria = buildFindClientByIdOrClientIDCriteria this, role
      return if not clCriteria

    yield Channel.update(criteria, { $push: allow: role.name }, { multi: true }).exec()
    if role.clients
      yield Client.update(clCriteria, { $push: roles: role.name }, { multi: true }).exec()

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
    result = yield Channel.find({'allow': {'$in': [name]}}, {'name': 1 }).exec()
    if result is null or result.length is 0
      return utils.logAndSetResponse this, 404, "Role with name '#{name}' could not be found.", 'info'

    if role.name
      # do check here but only perform rename updates later after channel/client updates
      channels = yield Channel.find({'allow': {'$in': [role.name]}}, {'name': 1 }).exec()
      clients = yield Client.find({'roles': {'$in': [role.name]}}, {'name': 1 }).exec()
      if channels?.length > 0 or clients?.length > 0
        return utils.logAndSetResponse this, 400, "Role with name '#{role.name}' already exists.", 'info'

    if role.channels
      criteria = buildFindChannelByIdOrNameCriteria this, role
      return if not criteria
    if role.clients
      clCriteria = buildFindClientByIdOrClientIDCriteria this, role
      return if not clCriteria

    if role.channels
      yield Channel.update({}, { $pull: allow: name }, { multi: true }).exec()
      if role.channels.length > 0
        yield Channel.update(criteria, { $push: allow: name }, { multi: true }).exec()

    if role.clients or (role.channels and role.channels.length is 0) # also clear clients if channels length is 0
      yield Client.update({}, { $pull: roles: name }, { multi: true }).exec()
    if role.clients?.length > 0
      yield Client.update(clCriteria, { $push: roles: name }, { multi: true }).exec()

    if role.name
      # rename role
      yield Channel.update({ allow: $in: [name] }, { $push: allow: role.name }, { multi: true }).exec()
      yield Channel.update({ allow: $in: [name] }, { $pull: allow: name }, { multi: true }).exec()
      yield Client.update({ roles: $in: [name] }, { $push: roles: role.name }, { multi: true }).exec()
      yield Client.update({ roles: $in: [name] }, { $pull: roles: name }, { multi: true }).exec()

    logger.info "User #{this.authenticated.email} updated role with name '#{name}'"
    this.body = 'Successfully updated role'
    this.status = 200
  catch e
    logger.error "Could not update role with name '#{name}' via the API: #{e.message}"
    this.body = e.message
    this.status = 500


exports.deleteRole = (name) ->
  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to updateRole denied.", 'info'
    return

  try
    result = yield Channel.find({'allow': {'$in': [name]}}, {'name': 1 }).exec()
    if result is null or result.length is 0
      return utils.logAndSetResponse this, 404, "Role with name '#{name}' could not be found.", 'info'

    yield Channel.update({}, { $pull: allow: name }, { multi: true }).exec()
    yield Client.update({}, { $pull: roles: name }, { multi: true }).exec()

    logger.info "User #{this.authenticated.email} deleted role with name '#{name}'"
    this.body = 'Successfully deleted role'
  catch e
    logger.error "Could not update role with name '#{name}' via the API: #{e.message}"
    this.body = e.message
    this.status = 500
