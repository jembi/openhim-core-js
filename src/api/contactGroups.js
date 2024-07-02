'use strict'

import logger from 'winston'

import * as authorisation from './authorisation'
import * as utils from '../utils'
import {ChannelModelAPI} from '../model/channels'
import {ContactGroupModelAPI} from '../model/contactGroups'

export async function addContactGroup(ctx) {
  try {
    const authorised = await utils.checkUserPermission(ctx, 'addContactGroup', 'contact-list-manage')

    if (!authorised) return

    const contactGroupData = ctx.request.body

    const contactGroup = new ContactGroupModelAPI(contactGroupData)
    await contactGroup.save()

    utils.logAndSetResponse(
      ctx,
      201,
      'Contact Group successfully created',
      'info'
    )
  } catch (err) {
    utils.logAndSetResponse(
      ctx,
      400,
      `Could not add a contact group via the API: ${err}`,
      'error'
    )
  }
}

export async function getContactGroup(ctx, contactGroupId) {
  try {
    const authorised = await utils.checkUserPermission(ctx, 'getContactGroup', 'contact-list-view')

    if (!authorised) return

    contactGroupId = unescape(contactGroupId)

    const result = await ContactGroupModelAPI.findById(contactGroupId).exec()

    if (result === null) {
      ctx.body = `Contact Group with id '${contactGroupId}' could not be found.`
      ctx.status = 404
    } else {
      ctx.body = result
    }
  } catch (err) {
    utils.logAndSetResponse(
      ctx,
      500,
      `Could not find Contact Group by id '${contactGroupId}' via the API: ${err}`,
      'error'
    )
  }
}

export async function updateContactGroup(ctx, contactGroupId) {
  try {
    const authorised = await utils.checkUserPermission(ctx, 'updateContactGroup', 'contact-list-manage')

    if (!authorised) return

    contactGroupId = unescape(contactGroupId)
    const contactGroupData = ctx.request.body

    // Ignore _id if it exists, a user shouldnt be able to update the internal id
    if (contactGroupData._id) {
      delete contactGroupData._id
    }

    await ContactGroupModelAPI.findByIdAndUpdate(
      contactGroupId,
      contactGroupData
    ).exec()
    ctx.body = 'Successfully updated contact group.'
    logger.info(
      `User ${ctx.authenticated.email} updated contact group with id ${contactGroupId}`
    )
  } catch (err) {
    utils.logAndSetResponse(
      ctx,
      500,
      `Could not update Contact Group by id ${contactGroupId} via the API: ${err}`,
      'error'
    )
  }
}

export async function removeContactGroup(ctx, contactGroupId) {
  try {
    const authorised = await utils.checkUserPermission(ctx, 'removeContactGroup', 'contact-list-manage')

    if (!authorised) return

    contactGroupId = unescape(contactGroupId)

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
      logger.info(
        `User ${ctx.authenticated.email} removed contact group with id ${contactGroupId}`
      )
    }
  } catch (err) {
    utils.logAndSetResponse(
      ctx,
      500,
      `Could not remove Contact Group by id ${contactGroupId} via the API: ${err}`,
      'error'
    )
  }
}

export async function getContactGroups(ctx) {
  try {
    const authorised = await utils.checkUserPermission(ctx, 'getContactGroups', 'contact-list-view')

    if (!authorised) return

    ctx.body = await ContactGroupModelAPI.find().exec()
  } catch (err) {
    utils.logAndSetResponse(
      ctx,
      500,
      `Could not fetch all Contact Group via the API: ${err}`,
      'error'
    )
  }
}
