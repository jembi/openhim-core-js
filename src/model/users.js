'use strict'

import {Schema} from 'mongoose'

import {PassportModelAPI, createPassport, updatePassport} from './passport'
import {connectionAPI, connectionDefault} from '../config'
import {hashPassword} from '../utils'

const UserSchema = new Schema({
  firstname: {
    type: String,
    required: true
  },
  surname: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  passports: {type: Schema.Types.ObjectId, ref: 'Passport'},
  /* --- @deprecated --- */
  passwordAlgorithm: String,
  passwordHash: String,
  passwordSalt: String,
  /* --- ----------- --- */
  provider: {
    type: String,
    enum: ['openid', 'local', 'token'], // token is deprecated
    default: 'local'
  },
  groups: [String],
  msisdn: String,
  dailyReport: Boolean,
  weeklyReport: Boolean,
  settings: Object,
  token: String,
  tokenType: {
    type: String,
    enum: ['newUser', 'existingUser', null]
  }, // null is needed as we used nulls to clear to token and tokenType
  expiry: Date,
  locked: Boolean
})

// compile the User Schema into a Model
export const UserModelAPI = connectionAPI.model('User', UserSchema)
export const UserModel = connectionDefault.model('User', UserSchema)

/**
 * Register a new user
 *
 * This method creates a new user from a specified email, username and password
 * and assign the newly created user a local Passport.
 *
 */
export const createUser = async function (newUserData) {
  // Create a clone to newUserData
  const userToBeCreated = {...newUserData}

  let result = {error: null, user: null}

  try {
    let password = await hashPassword(userToBeCreated.password)
    delete userToBeCreated.password

    const {passwordHash, passwordAlgorithm, passwordSalt} = userToBeCreated

    if (passwordHash || passwordAlgorithm || passwordSalt) {
      delete userToBeCreated.passwordHash
      delete userToBeCreated.passwordSalt
      delete userToBeCreated.passwordAlgorithm
    }

    return await UserModelAPI.create(userToBeCreated)
      .then(async function (user) {
        return await createPassport(user, {password})
      })
      .catch(err => {
        result.error = err
        return result
      })
  } catch (err) {
    result.error = err
    return result
  }
}

/**
 * Update user
 *
 * This method updates an user based on its id or username if id is not present
 * and assign the newly created user a local Passport.
 *
 */
export const updateUser = async function (newUserData) {
  // Create a clone to newUserData
  const userToBeUpdated = {...newUserData}

  let result = {user: null, error: null}

  try {
    let password
    if (userToBeUpdated.password) {
      password = await hashPassword(userToBeUpdated.password)

      delete userToBeUpdated.password
    }

    await UserModelAPI.findByIdAndUpdate(userToBeUpdated.id, userToBeUpdated, {
      new: true
    })
      .then(async function (user) {
        // Check if password has a string to replace it
        if (password) {
          await PassportModelAPI.findOne({
            protocol: 'local',
            email: user.email
          }).then(async function (passport) {
            if (passport) {
              passport.password = password
              result = await updatePassport(user, passport)
            } else {
              result = await createPassport(user, {password})
            }
          })
        } else {
          result.user = user
        }
      })
      .catch(err => {
        result.error = err
      })

    return result
  } catch (err) {
    result.error = err
    return result
  }
}

/**
 * @deprecated
 * Update user (token provider)
 *
 * Please consider upgrading and use updateUser instead.
 *
 * This method updates an user based on its id or username if id is not present
 * and assign the newly created user a token Passport.
 *
 */
export const updateTokenUser = async function (newUserData) {
  const provider = newUserData.provider ? newUserData.provider : 'token'
  // Create a clone to newUserData
  const userToBeUpdated = {...newUserData, provider}

  let result = {user: null, error: null}

  const {passwordHash, passwordAlgorithm, passwordSalt} = userToBeUpdated

  if (passwordHash || passwordAlgorithm || passwordSalt) {
    userToBeUpdated.passwordHash = null
    userToBeUpdated.passwordSalt = null
    userToBeUpdated.passwordAlgorithm = null
  }

  await UserModelAPI.findByIdAndUpdate(userToBeUpdated.id, userToBeUpdated, {
    new: true
  })
    .then(async function (user) {
      // Check if password has a string to replace it
      if (passwordHash && passwordAlgorithm && passwordSalt) {
        await PassportModelAPI.findOne({
          protocol: 'token',
          email: user.email
        }).then(async function (passport) {
          if (passport) {
            passport.passwordHash = passwordHash
            passport.passwordAlgorithm = passwordAlgorithm
            passport.passwordSalt = passwordSalt
            result = await updatePassport(user, passport)
          } else {
            result = await createPassport(user, {
              passwordHash,
              passwordAlgorithm,
              passwordSalt
            })
          }
        })
      } else {
        result.user = user
      }
    })
    .catch(err => {
      result.error = err
    })

  return result
}
