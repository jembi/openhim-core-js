'use strict'

import {ChannelModelAPI} from '../model/channels'
import { RoleModelAPI } from '../model/role'

export function inGroup(group, user) {
  return user.groups.indexOf(group) >= 0
}

const getUserChannelsByPermissions = (user, allPermission, specifiedPermission) =>
  RoleModelAPI.find({name: {$in: user.groups}}).then(roles => {
    if (roles.find(role => role.permissions[allPermission] || role.permissions[allPermission.replace('view', 'manage')])) {
      return ChannelModelAPI.find({}).exec()
    }
    const specifiedChannels = roles.reduce((prev, curr) =>
      prev.concat(curr.permissions[specifiedPermission], curr.permissions[specifiedPermission.replace('view', 'manage')]),
      []
    )
    return ChannelModelAPI.find({_id: {$in: specifiedChannels}}).exec()
  })

/**
 * A promise returning function that returns the list
 * of viewable channels for a user.
 */
export function getUserViewableChannels(user) {
  return getUserChannelsByPermissions(user, 'channel-view-all', 'channel-view-specified')
}

/**
 * A promise returning function that returns the list
 * of rerunnable channels for a user.
 */
export function getUserRerunableChannels(user) {
  return getUserChannelsByPermissions(user, 'transaction-rerun-all', 'transaction-rerun-specified')
}
