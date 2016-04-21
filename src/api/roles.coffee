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
  rolesMap = {} # K: permission, V: channels that share permission
  for ch in channels
    for permission in ch.allow
      isClient = false
      for cl in allClients
        if cl.clientID is permission
          isClient = true

      if not isClient
        if not rolesMap[permission] then rolesMap[permission] = channels: []
        rolesMap[permission].channels.push _id: ch._id, name: ch.name

  rolesArray = []
  for role of rolesMap
    rolesArray.push
      name: role
      channels: rolesMap[role].channels
      clients: ((allClients.filter (cl) -> role in cl.roles).map (fc) -> _id: fc._id, clientID: fc.clientID)

  return rolesArray


exports.getRoles = ->
  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    return utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getRoles denied.", 'info'

  try
    channels = yield Channel.find({}, {name: 1, allow: 1 }).exec()
    clients = yield Client.find({}, {clientID: 1, roles: 1 }).exec()

    this.body = filterRolesFromChannels channels, clients
  catch e
    logger.error "Could not fetch roles via the API: #{e.message}"
    this.message = e.message
    this.status = 500


exports.getRole = (name) ->
  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    return utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getRole denied.", 'info'

  try
    channels = yield Channel.find({allow: {$in: [name]}}, {name: 1 }).exec()
    clients = yield Client.find({ roles: $in: [name]}, {clientID: 1 }).exec()
    if (channels is null or channels.length is 0) and (clients is null or clients.length is 0)
      utils.logAndSetResponse this, 404, "Role with name '#{name}' could not be found.", 'info'
    else
      this.body =
        name: name
        channels: channels.map (r) -> _id: r._id, name: r.name
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
    return utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to addRole denied.", 'info'

  role = this.request.body
  if not role.name
    return utils.logAndSetResponse this, 400, 'Must specify a role name', 'info'
  if role.channels?.length is 0 and role.clients?.length is 0
    return utils.logAndSetResponse this, 400, 'Must specify at least one channel or client to link the role to', 'info'

  try
    chResult = yield Channel.find({allow: {$in: [role.name]}}, {name: 1 }).exec()
    clResult = yield Client.find({roles: {$in: [role.name]}}, {clientID: 1 }).exec()
    if chResult?.length > 0 or clResults?.length > 0
      return utils.logAndSetResponse this, 400, "Role with name '#{role.name}' already exists.", 'info'

    if role.channels
      chCriteria = buildFindChannelByIdOrNameCriteria this, role
      return if not chCriteria

    if role.clients
      clCriteria = buildFindClientByIdOrClientIDCriteria this, role
      return if not clCriteria

    if role.channels
      yield Channel.update(chCriteria, { $push: allow: role.name }, { multi: true }).exec()
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
    return utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to updateRole denied.", 'info'

  role = this.request.body

  try
    # request validity checks
    chResult = yield Channel.find({allow: {$in: [name]}}, {name: 1 }).exec()
    clResult = yield Client.find({roles: {$in: [name]}}, {clientID: 1 }).exec()
    if (chResult is null or chResult.length is 0) and (clResult is null or clResult.length is 0)
      return utils.logAndSetResponse this, 404, "Role with name '#{name}' could not be found.", 'info'

    if role.name
      # do check here but only perform rename updates later after channel/client updates
      channels = yield Channel.find({allow: {$in: [role.name]}}, {name: 1 }).exec()
      clients = yield Client.find({roles: {$in: [role.name]}}, {name: 1 }).exec()
      if channels?.length > 0 or clients?.length > 0
        return utils.logAndSetResponse this, 400, "Role with name '#{role.name}' already exists.", 'info'

    if role.channels
      chCriteria = buildFindChannelByIdOrNameCriteria this, role
      return if not chCriteria
    if role.clients
      clCriteria = buildFindClientByIdOrClientIDCriteria this, role
      return if not clCriteria

    # update channels
    if role.channels
      # clear role from existing
      yield Channel.update({}, { $pull: allow: name }, { multi: true }).exec()
      # set role on channels
      if role.channels.length > 0
        yield Channel.update(chCriteria, { $push: allow: name }, { multi: true }).exec()

    # update clients
    if role.clients
      # clear role from existing
      yield Client.update({}, { $pull: roles: name }, { multi: true }).exec()
      # set role on clients
      if role.clients?.length > 0
        yield Client.update(clCriteria, { $push: roles: name }, { multi: true }).exec()

    # rename role
    if role.name
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
    return utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to updateRole denied.", 'info'

  try
    channels = yield Channel.find({allow: {$in: [name]}}, {name: 1 }).exec()
    clients = yield Client.find({ roles: $in: [name]}, {clientID: 1 }).exec()
    if (channels is null or channels.length is 0) and (clients is null or clients.length is 0)
      return utils.logAndSetResponse this, 404, "Role with name '#{name}' could not be found.", 'info'

    yield Channel.update({}, { $pull: allow: name }, { multi: true }).exec()
    yield Client.update({}, { $pull: roles: name }, { multi: true }).exec()

    logger.info "User #{this.authenticated.email} deleted role with name '#{name}'"
    this.body = 'Successfully deleted role'
  catch e
    logger.error "Could not update role with name '#{name}' via the API: #{e.message}"
    this.body = e.message
    this.status = 500
