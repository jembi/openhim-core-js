import logger from 'winston'
import { ContactGroupModelAPI } from '../model/contactGroups'
import * as authorisation from './authorisation'
import { ChannelModelAPI } from '../model/channels'

import * as utils from '../utils'

export async function addContactGroup (ctx) {
  // Must be admin
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to addContactGroup denied.`, 'info')
    return
  }

  const contactGroupData = ctx.request.body

  try {
    const contactGroup = new ContactGroupModelAPI(contactGroupData)
    await contactGroup.save()

    utils.logAndSetResponse(ctx, 201, 'Contact Group successfully created', 'info')
  } catch (err) {
    utils.logAndSetResponse(ctx, 400, `Could not add a contact group via the API: ${err}`, 'error')
  }
}

export async function getContactGroup (ctx, contactGroupId) {
  // Must be admin
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to getContactGroup denied.`, 'info')
    return
  }

  contactGroupId = unescape(contactGroupId)

  try {
    const result = await ContactGroupModelAPI.findById(contactGroupId).exec()

    if (result === null) {
      ctx.body = `Contact Group with id '${contactGroupId}' could not be found.`
      ctx.status = 404
    } else {
      ctx.body = result
    }
  } catch (err) {
    utils.logAndSetResponse(ctx, 500, `Could not find Contact Group by id '${contactGroupId}' via the API: ${err}`, 'error')
  }
}

export async function updateContactGroup (ctx, contactGroupId) {
  // Must be admin
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to updateContactGroup denied.`, 'info')
    return
  }

  contactGroupId = unescape(contactGroupId)
  const contactGroupData = ctx.request.body

  // Ignore _id if it exists, a user shouldnt be able to update the internal id
  if (contactGroupData._id) {
    delete contactGroupData._id
  }

  try {
    await ContactGroupModelAPI.findByIdAndUpdate(contactGroupId, contactGroupData).exec()
    ctx.body = 'Successfully updated contact group.'
    logger.info(`User ${ctx.authenticated.email} updated contact group with id ${contactGroupId}`)
  } catch (err) {
    utils.logAndSetResponse(ctx, 500, `Could not update Contact Group by id ${contactGroupId} via the API: ${err}`, 'error')
  }
}

export async function removeContactGroup (ctx, contactGroupId) {
  // Must be admin
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to removeContactGroup denied.`, 'info')
    return
  }

  contactGroupId = unescape(contactGroupId)
  try {
    const linkedAlerts = await ChannelModelAPI.find({
      alerts: {
        $elemMatch: {
          groups: {
            $in: [contactGroupId]
          }
        }
      }
    }).exec()
    if (linkedAlerts.length > 0) {
      ctx.status = 409
      ctx.body = linkedAlerts
    } else {
      await ContactGroupModelAPI.findByIdAndRemove(contactGroupId).exec()
      ctx.body = `Successfully removed contact group with ID '${contactGroupId}'`
      logger.info(`User ${ctx.authenticated.email} removed contact group with id ${contactGroupId}`)
    }
  } catch (err) {
    utils.logAndSetResponse(ctx, 500, `Could not remove Contact Group by id ${contactGroupId} via the API: ${err}`, 'error')
  }
}

export async function getContactGroups (ctx) {
  // Must be admin
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to getContactGroups denied.`, 'info')
    return
  }

  try {
    ctx.body = await ContactGroupModelAPI.find().exec()
  } catch (err) {
    utils.logAndSetResponse(ctx, 500, `Could not fetch all Contact Group via the API: ${err}`, 'error')
  }
}
