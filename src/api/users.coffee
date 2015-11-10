User = require('../model/users').User
Q = require 'q'
logger = require 'winston'
authorisation = require './authorisation'

moment = require 'moment'
randtoken = require 'rand-token'
contact = require '../contact'
config = require "../config/config"
config.newUserExpiry = config.get('newUserExpiry')
utils = require "../utils"
atna = require 'atna-audit'
os = require 'os'
auditing = require '../auditing'

###
# Get authentication details
###
exports.authenticate = (email) ->
  email = unescape email

  try
    user = yield User.findOne(email: email).exec()

    if not user
      utils.logAndSetResponse this, 404, "Could not find user by email #{email}", 'info'
      # User NOT authenticated, send audit
      audit = atna.userLoginAudit atna.OUTCOME_SERIOUS_FAILURE, 'openhim', os.hostname(), email
      audit = atna.wrapInSyslog audit
      auditing.processAudit audit, -> logger.debug 'Processed internal audit'
    else
      this.body =
        salt: user.passwordSalt
        ts: new Date()

      # User authenticated, send audit
      audit = atna.userLoginAudit atna.OUTCOME_SUCCESS, 'openhim', os.hostname(), email, user.groups.join(','), user.groups.join(',')
      audit = atna.wrapInSyslog audit
      auditing.processAudit audit, -> logger.debug 'Processed internal audit'
  catch e
    utils.logAndSetResponse this, 500, "Error during authentication #{e}", 'error'


#######################################
### New User Set Password Functions ###
#######################################

# get the new user details
exports.getNewUser = (token) ->
  token = unescape token

  try
    projectionRestriction = "firstname": 1, "surname": 1, "msisdn": 1, "token": 1, "locked": 1, "expiry": 1, "_id": 0

    result = yield User.findOne(token: token, projectionRestriction).exec()
    if not result
      this.body = "User with token #{token} could not be found."
      this.status = 404
    else
      # if expiry date has past
      if moment(result.expiry).utc().format() < moment().utc().format()
        # new user- set password - expired
        this.body = "User with token #{token} has expired to set their password."
        this.status = 410
      else
        # valid new user - set password
        this.body = result
  catch e
    utils.logAndSetResponse this, 500, "Could not find user with token #{token} via the API #{e}", 'error'


# update the password/details for the new user
exports.updateNewUser = (token) ->
  token = unescape token
  userData = this.request.body

  try
    # first try get new user details to check expiry date
    newUserOldData = yield User.findOne(token: token).exec()

    if not newUserOldData
      this.body = "User with token #{token} could not be found."
      this.status = 404
      return
    else
      # if expiry date has past
      if moment(newUserOldData.expiry).utc().format() < moment().utc().format()
        # new user- set password - expired
        this.body = "User with token #{token} has expired to set their password."
        this.status = 410
        return

  catch e
    utils.logAndSetResponse this, 500, "Could not find user with token #{token} via the API #{e}", 'error'
    return


  # check to make sure 'msisdn' isnt 'undefined' when saving
  if userData.msisdn then msisdn = userData.msisdn else msisdn = null

  # construct user object to prevent other properties from being updated
  newUserUpdate =
    firstname: userData.firstname
    surname: userData.surname
    token: null
    locked: false
    expiry: null
    msisdn: msisdn
    passwordAlgorithm: userData.passwordAlgorithm
    passwordSalt: userData.passwordSalt
    passwordHash: userData.passwordHash

  try
    yield User.findOneAndUpdate(token: token, newUserUpdate).exec()
    this.body = "Successfully set new user password."
    logger.info "New user updated by token #{token}"
  catch e
    utils.logAndSetResponse this, 500, "Could not update user with token #{token} via the API #{e}", 'error'


#######################################
### New User Set Password Functions ###
#######################################


plainMessageTemplate = (firstname, setPasswordLink) -> """
<---------- New User - Set Password ---------->
Hi #{firstname},

A profile has been created for you on OpenHIM
Follow the below link to set your password and log into OpenHIM Console
#{setPasswordLink}
<---------- New User - Set Password ---------->
"""

htmlMessageTemplate = (firstname, setPasswordLink) -> """
<h1>New OpenHIM Profile</h1>
<p>Hi #{firstname},<br/><br/>A profile has been created for you on OpenHIM</p>
<p>Follow the below link to set your password and log into OpenHIM Console</p>
<p>#{setPasswordLink}</p>
"""

###
# Adds a user
###
exports.addUser = ->
  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to addUser denied.", 'info'
    return

  userData = this.request.body

  # Generate the new user token here
  # set locked = true
  # set expiry date = true

  token = randtoken.generate 32
  userData.token = token
  userData.locked = true

  duration = config.newUserExpiry.duration
  durationType = config.newUserExpiry.durationType
  userData.expiry = moment().add(duration, durationType).utc().format()

  consoleURL = config.alerts.consoleURL
  setPasswordLink = "#{consoleURL}/#/set-password/#{token}"

  try
    user = new User userData
    result = yield Q.ninvoke user, 'save'

    # Send email to new user to set password

    plainMessage = plainMessageTemplate userData.firstname, setPasswordLink
    htmlMessage = htmlMessageTemplate userData.firstname, setPasswordLink

    contact.contactUser 'email', userData.email, 'OpenHIM Console Profile', plainMessage, htmlMessage, ->
      logger.info 'The email has been sent to the new user'

    this.body = 'User successfully created'
    this.status = 201
    logger.info "User #{this.authenticated.email} created user #{userData.email}"
  catch e
    utils.logAndSetResponse this, 500, "Could not add user via the API #{e}", 'error'


###
# Retrieves the details of a specific user
###
exports.getUser = (email) ->

  email = unescape email

  # Test if the user is authorised, allow a user to fetch their own details
  if not authorisation.inGroup('admin', this.authenticated) and this.authenticated.email isnt email
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getUser denied.", 'info'
    return

  try
    result = yield User.findOne(email: email).exec()
    if not result
      this.body = "User with email #{email} could not be found."
      this.status = 404
    else
      this.body = result
  catch e
    utils.logAndSetResponse this, 500, "Could not get user via the API #{e}", 'error'


exports.updateUser = (email) ->

  email = unescape email

  # Test if the user is authorised, allow a user to update their own details
  if not authorisation.inGroup('admin', this.authenticated) and this.authenticated.email isnt email
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to updateUser denied.", 'info'
    return

  userData = this.request.body

  # reset token/locked/expiry when user is updated and password supplied
  if userData.passwordAlgorithm and userData.passwordHash and userData.passwordSalt
    userData.token = null
    userData.locked = false
    userData.expiry = null

  # Don't allow a non-admin user to change their groups
  if this.authenticated.email is email and not authorisation.inGroup 'admin', this.authenticated then delete userData.groups

  #Ignore _id if it exists (update is by email)
  if userData._id then delete userData._id

  try
    yield User.findOneAndUpdate(email: email, userData).exec()
    this.body = "Successfully updated user."
    logger.info "User #{this.authenticated.email} updated user #{userData.email}"
  catch e
    utils.logAndSetResponse this, 500, "Could not update user #{email} via the API #{e}", 'error'


exports.removeUser = (email) ->

  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to removeUser denied.", 'info'
    return

  email = unescape email

  # Test if the user is root@openhim.org
  if email is 'root@openhim.org'
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is OpenHIM root, User cannot be deleted through the API", 'info'
    return

  try
    yield User.findOneAndRemove(email: email).exec()
    this.body = "Successfully removed user with email #{email}"
    logger.info "User #{this.authenticated.email} removed user #{email}"
  catch e
    utils.logAndSetResponse this, 500, "Could not remove user #{email} via the API #{e}", 'error'


exports.getUsers = ->
  # Test if the user is authorised
  if not authorisation.inGroup 'admin', this.authenticated
    utils.logAndSetResponse this, 403, "User #{this.authenticated.email} is not an admin, API access to getUsers denied.", 'info'
    return

  try
    this.body = yield User.find().exec()
  catch e
    utils.logAndSetResponse this, 500, "Could not fetch all users via the API #{e}", 'error'
