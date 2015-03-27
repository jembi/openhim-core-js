ContactGroup = require('../model/contactGroups').ContactGroup
Q = require 'q'
logger = require 'winston'
authorisation = require './authorisation'
Channel = require('../model/channels').Channel

utils = require "../utils"

###############################
#     Adds a contactGroup     #
###############################
exports.addContactGroup = ->
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to addContactGroup denied.", 'info'
    return

  contactGroupData = this.request.body

  try
    contactGroup = new ContactGroup contactGroupData
    result = yield Q.ninvoke(contactGroup, 'save')

    utils.logAndSetResponse this, 201, "Contact Group successfully created", 'info'
  catch err
    utils.logAndSetResponse this, 400, "Could not add a contact group via the API: #{err}", 'error'



#############################################################
#     Retrieves the details of a specific contact group     #
#############################################################
exports.getContactGroup = (contactGroupId) ->
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getContactGroup denied.", 'info'
    return

  contactGroupId = unescape contactGroupId

  try
    result = yield ContactGroup.findById(contactGroupId).exec()

    if result == null
      this.body = "Contact Group with id '#{contactGroupId}' could not be found."
      this.status = 404
    else
      this.body = result
  catch err
    utils.logAndSetResponse this, 500, "Could not find Contact Group by id '#{contactGroupId}' via the API: #{err}", 'error'



##################################
#     Updates a contactGroup     #
##################################
exports.updateContactGroup = (contactGroupId) ->
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to updateContactGroup denied.", 'info'
    return

  contactGroupId = unescape contactGroupId
  contactGroupData = this.request.body

  # Ignore _id if it exists, a user shouldnt be able to update the internal id
  if contactGroupData._id
    delete contactGroupData._id

  try
    yield ContactGroup.findByIdAndUpdate(contactGroupId, contactGroupData).exec()
    this.body = "Successfully updated contact group."
    logger.info "User #{this.authenticated.email} updated contact group with id #{contactGroupId}"
  catch err
    utils.logAndSetResponse this, 500, "Could not update Contact Group by id #{contactGroupId} via the API: #{err}", 'error'




##################################
#     Removes a contactGroup     #
##################################
exports.removeContactGroup = (contactGroupId) ->
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to removeContactGroup denied.", 'info'
    return

  contactGroupId = unescape contactGroupId

  try
    # find out if there are any alerts associated with this group
    linkedAlerts = yield Channel.find({
      alerts :{
        $elemMatch :{
          groups: {
            $in: [contactGroupId]
          }
        }
      }
    }).exec()
    if linkedAlerts.length > 0
      this.status = 409
      this.body = linkedAlerts
    else
      yield ContactGroup.findByIdAndRemove(contactGroupId).exec()
      this.body = "Successfully removed contact group with ID '#{contactGroupId}'"
      logger.info "User #{this.authenticated.email} removed contact group with id #{contactGroupId}"
  catch err
    utils.logAndSetResponse this, 500, "Could not remove Contact Group by id {contactGroupId} via the API: #{err}", 'error'




#######################################
#     Retrieves all contactGroups     #
#######################################
exports.getContactGroups = ->
  # Must be admin
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getContactGroups denied.", 'info'
    return

  try
    this.body = yield ContactGroup.find().exec()
  catch err
    utils.logAndSetResponse this, 500, "Could not fetch all Contact Group via the API: #{err}", 'error'
