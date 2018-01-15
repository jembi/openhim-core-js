import logger from 'winston'
import moment from 'moment'
import atna from 'atna-audit'
import os from 'os'
import { UserModelAPI } from '../model/users'
import * as authorisation from './authorisation'
import * as contact from '../contact'
import { config } from '../config'
import * as utils from '../utils'
import * as auditing from '../auditing'
import crypto from 'crypto'
import { promisify } from 'util'

config.newUserExpiry = config.get('newUserExpiry')
config.userPasswordResetExpiry = config.get('userPasswordResetExpiry')
config.alerts = config.get('alerts')

const himSourceID = config.get('auditing').auditEvents.auditSourceID

/*
 * Get authentication details
 */

export async function authenticate (ctx, email) {
  email = unescape(email)

  try {
    const user = await UserModelAPI.findOne({ email: utils.caseInsensitiveRegex(email) })

    if (!user) {
      utils.logAndSetResponse(ctx, 404, `Could not find user by email ${email}`, 'info')
      // Audit unknown user requested
      let audit = atna.construct.userLoginAudit(atna.constants.OUTCOME_SERIOUS_FAILURE, himSourceID, os.hostname(), email)
      audit = atna.construct.wrapInSyslog(audit)
      return auditing.sendAuditEvent(audit, () => logger.debug('Processed internal audit'))
    } else {
      ctx.body = {
        salt: user.passwordSalt,
        ts: new Date()
      }
    }
  } catch (e) {
    return utils.logAndSetResponse(ctx, 500, `Error during authentication ${e}`, 'error')
  }
}

/**
 * Reset password Functions
 */

const passwordResetPlainMessageTemplate = (firstname, setPasswordLink) => `\
<---------- Existing User - Reset Password ---------->
Hi ${firstname},

A request has been made to reset your password on the OpenHIM instance running on ${config.alerts.himInstance}
Follow the below link to reset your password and log into OpenHIM Console
${setPasswordLink}
<---------- Existing User - Reset Password ---------->\
`

const passwordResetHtmlMessageTemplate = (firstname, setPasswordLink) => `\
<h1>Reset OpenHIM Password</h1>
<p>Hi ${firstname},<br/><br/>A request has been made to reset your password on the OpenHIM instance running on ${config.alerts.himInstance}</p>
<p>Follow the below link to set your password and log into OpenHIM Console</p>
<p>${setPasswordLink}</p>\
`

function generateRandomToken () {
  return crypto.randomBytes(16).toString('hex')
}

/*
 * update user token/expiry and send new password email
 */
export async function userPasswordResetRequest (ctx, email) {
  email = unescape(email)
  if (email === 'root@openhim.org') {
    ctx.body = 'Cannot request password reset for \'root@openhim.org\''
    ctx.status = 403
    return
  }

  // Generate the new user token here
  // set expiry date = true
  const token = generateRandomToken()
  const { duration, durationType } = config.userPasswordResetExpiry
  const expiry = moment().add(duration, durationType).utc().format()

  const updateUserTokenExpiry = {
    token,
    tokenType: 'existingUser',
    expiry
  }

  try {
    const user = await UserModelAPI.findOneAndUpdate({ email: utils.caseInsensitiveRegex(email) }, updateUserTokenExpiry)
    if (!user) {
      ctx.body = `Tried to request password reset for invalid email address: ${email}`
      ctx.status = 404
      logger.info(`Tried to request password reset for invalid email address: ${email}`)
      return
    }

    const { consoleURL } = config.alerts
    const setPasswordLink = `${consoleURL}/#!/set-password/${token}`

    // Send email to user to reset password
    const plainMessage = passwordResetPlainMessageTemplate(user.firstname, setPasswordLink)
    const htmlMessage = passwordResetHtmlMessageTemplate(user.firstname, setPasswordLink)

    const sendEmail = promisify(contact.contactUser)
    const sendEmailError = await sendEmail('email', email, 'OpenHIM Console Password Reset', plainMessage, htmlMessage)
    if (sendEmailError) {
      utils.logAndSetResponse(ctx, 500, `Could not send email to user via the API ${sendEmailError}`, 'error')
      return
    }

    logger.info('The email has been sent to the user')
    ctx.body = 'Successfully set user token/expiry for password reset.'
    ctx.status = 201
    return logger.info(`User updated token/expiry for password reset ${email}`)
  } catch (error) {
    utils.logAndSetResponse(ctx, 500, `Could not update user with email ${email} via the API ${error}`, 'error')
  }
}

/**
 *New User Set Password Functions
 */

// get the new user details
export async function getUserByToken (ctx, token) {
  token = unescape(token)

  try {
    const projectionRestriction = {
      email: 1,
      firstname: 1,
      surname: 1,
      msisdn: 1,
      token: 1,
      tokenType: 1,
      locked: 1,
      expiry: 1,
      _id: 0
    }

    const result = await UserModelAPI.findOne({ token }, projectionRestriction)
    if (!result) {
      ctx.body = `User with token ${token} could not be found.`
      ctx.status = 404
    } else if (moment(result.expiry).isBefore(moment())) {
      // user- set password - expired
      ctx.body = `Token ${token} has expired`
      ctx.status = 410
    } else {
      ctx.body = result
    }
  } catch (e) {
    utils.logAndSetResponse(ctx, 500, `Could not find user with token ${token} via the API ${e}`, 'error')
  }
}

// update the password/details for the new user
export async function updateUserByToken (ctx, token) {
  let userDataExpiry
  token = unescape(token)
  const userData = ctx.request.body

  try {
    // first try get new user details to check expiry date
    userDataExpiry = await UserModelAPI.findOne({ token })

    if (!userDataExpiry) {
      ctx.body = `User with token ${token} could not be found.`
      ctx.status = 404
      return
    } else if (moment(userDataExpiry.expiry).isBefore(moment())) {
      // new user- set password - expired
      ctx.body = `User with token ${token} has expired to set their password.`
      ctx.status = 410
      return
    }
  } catch (error) {
    utils.logAndSetResponse(ctx, 500, `Could not find user with token ${token} via the API ${error}`, 'error')
    return
  }

  // check to make sure 'msisdn' isnt 'undefined' when saving
  let msisdn = null
  if (userData.msisdn) {
    msisdn = userData.msisdn
  }

  // construct user object to prevent other properties from being updated
  const userUpdateObj = {
    token: null,
    tokenType: null,
    expiry: null,
    passwordAlgorithm: userData.passwordAlgorithm,
    passwordSalt: userData.passwordSalt,
    passwordHash: userData.passwordHash
  }

  if (userDataExpiry.tokenType === 'newUser') {
    userUpdateObj.firstname = userData.firstname
    userUpdateObj.surname = userData.surname
    userUpdateObj.locked = false
    userUpdateObj.msisdn = msisdn
  }

  try {
    await UserModelAPI.findOneAndUpdate({ token }, userUpdateObj)
    ctx.body = 'Successfully set new user password.'
    return logger.info(`User updated by token ${token}`)
  } catch (error) {
    return utils.logAndSetResponse(ctx, 500, `Could not update user with token ${token} via the API ${error}`, 'error')
  }
}

/**
 New User Set Password Functions
 */

const plainMessageTemplate = (firstname, setPasswordLink) => `\
<---------- New User - Set Password ---------->
Hi ${firstname},

A profile has been created for you on the OpenHIM instance running on ${config.alerts.himInstance}
Follow the below link to set your password and log into OpenHIM Console
${setPasswordLink}
<---------- New User - Set Password ---------->\
`

const htmlMessageTemplate = (firstname, setPasswordLink) => `\
<h1>New OpenHIM Profile</h1>
<p>Hi ${firstname},<br/><br/>A profile has been created for you on the OpenHIM instance running on ${config.alerts.himInstance}</p>
<p>Follow the below link to set your password and log into OpenHIM Console</p>
<p>${setPasswordLink}</p>\
`

/*
 * Adds a user
 */
export async function addUser (ctx) {
  // Test if the user is authorised
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to addUser denied.`, 'info')
    return
  }

  const userData = ctx.request.body
  // Generate the new user token here
  // set locked = true
  // set expiry date = true

  const token = generateRandomToken()
  userData.token = token
  userData.tokenType = 'newUser'
  userData.locked = true
  userData.email = userData.email.toLowerCase()

  const { duration, durationType } = config.newUserExpiry
  userData.expiry = moment().add(duration, durationType).utc().format()

  const consoleURL = config.alerts.consoleURL
  const setPasswordLink = `${consoleURL}/#!/set-password/${token}`

  try {
    const user = new UserModelAPI(userData)
    await user.save()

    // Send email to new user to set password

    const plainMessage = plainMessageTemplate(userData.firstname, setPasswordLink)
    const htmlMessage = htmlMessageTemplate(userData.firstname, setPasswordLink)

    contact.contactUser('email', userData.email, 'OpenHIM Console Profile', plainMessage, htmlMessage, (err) => {
      if (err) {
        return logger.error(`The email could not be sent to the user via the API ${err}`)
      } else {
        return logger.info('The email has been sent to the new user')
      }
    })

    ctx.body = 'User successfully created'
    ctx.status = 201
    logger.info(`User ${ctx.authenticated.email} created user ${userData.email}`)
  } catch (e) {
    utils.logAndSetResponse(ctx, 500, `Could not add user via the API ${e}`, 'error')
  }
}

/*
 * Retrieves the details of a specific user
 */
export async function getUser (ctx, email) {
  email = unescape(email)

  // Test if the user is authorised, allow a user to fetch their own details
  if (!authorisation.inGroup('admin', ctx.authenticated) && (ctx.authenticated.email !== email)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to getUser denied.`, 'info')
    return
  }

  try {
    const result = await UserModelAPI.findOne({ email: utils.caseInsensitiveRegex(email) })
    if (!result) {
      ctx.body = `User with email ${email} could not be found.`
      ctx.status = 404
    } else {
      ctx.body = result
    }
  } catch (e) {
    utils.logAndSetResponse(ctx, 500, `Could not get user via the API ${e}`, 'error')
  }
}

export async function updateUser (ctx, email) {
  email = unescape(email)

  // Test if the user is authorised, allow a user to update their own details
  if (!authorisation.inGroup('admin', ctx.authenticated) && (ctx.authenticated.email !== email)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to updateUser denied.`, 'info')
    return
  }

  const userData = ctx.request.body

  // reset token/locked/expiry when user is updated and password supplied
  if (userData.passwordAlgorithm && userData.passwordHash && userData.passwordSalt) {
    userData.token = null
    userData.tokenType = null
    userData.locked = false
    userData.expiry = null
  }

  // Don't allow a non-admin user to change their groups
  if ((ctx.authenticated.email === email) && !authorisation.inGroup('admin', ctx.authenticated)) { delete userData.groups }

  // Ignore _id if it exists (update is by email)
  if (userData._id) { delete userData._id }

  try {
    await UserModelAPI.findOneAndUpdate({ email: utils.caseInsensitiveRegex(email) }, userData)
    ctx.body = 'Successfully updated user.'
    logger.info(`User ${ctx.authenticated.email} updated user ${userData.email}`)
  } catch (e) {
    utils.logAndSetResponse(ctx, 500, `Could not update user ${email} via the API ${e}`, 'error')
  }
}

export async function removeUser (ctx, email) {
  // Test if the user is authorised
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to removeUser denied.`, 'info')
    return
  }

  email = unescape(email)

  // Test if the user is root@openhim.org
  if (email === 'root@openhim.org') {
    utils.logAndSetResponse(ctx, 403, 'User root@openhim.org is OpenHIM root, User cannot be deleted through the API', 'info')
    return
  }

  try {
    await UserModelAPI.findOneAndRemove({ email: utils.caseInsensitiveRegex(email) })
    ctx.body = `Successfully removed user with email ${email}`
    logger.info(`User ${ctx.authenticated.email} removed user ${email}`)
  } catch (e) {
    utils.logAndSetResponse(ctx, 500, `Could not remove user ${email} via the API ${e}`, 'error')
  }
}

export async function getUsers (ctx) {
  // Test if the user is authorised
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to getUsers denied.`, 'info')
    return
  }

  try {
    ctx.body = await UserModelAPI.find()
  } catch (e) {
    utils.logAndSetResponse(ctx, 500, `Could not fetch all users via the API ${e}`, 'error')
  }
}
