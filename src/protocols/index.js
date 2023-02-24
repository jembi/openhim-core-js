'use strict'

export * as local from './local'
export * as basic from './basic'
export * as openid from './openid'
import * as tokenProtocol from './token'

/**
 * @deprecated
 * token protocol is deprecated
 */
export const token = tokenProtocol
