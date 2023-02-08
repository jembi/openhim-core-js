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
export const createUser = async function (_user) {
  // Create a clone to _user
  const userToBeCreated = {..._user}

  let result = {error: null, user: null}

  try {
    let password = await hashPassword(userToBeCreated.password)
    delete userToBeCreated.password

    return await UserModelAPI.create(userToBeCreated)
      .then(async function (user) {
        return await createPassport(user, password)
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
export const updateUser = async function (_user) {
  // Create a clone to _user
  const userToBeCreated = {..._user}

  let result = {user: null, error: null}

  try {
    let password
    if (userToBeCreated.password) {
      password = await hashPassword(userToBeCreated.password)

      delete userToBeCreated.password
    }

    await UserModelAPI.findByIdAndUpdate(userToBeCreated.id, userToBeCreated, {
      new: true
    })
      .then(async function (user) {
        // Check if password has a string to replace it
        if (password) {
          await PassportModelAPI.findOne({
            protocol: 'local',
            user: user.id
          })
            .then(async function (passport) {
              if (passport) {
                passport.password = password
                result = await updatePassport(user, passport)
              } else {
                result = await createPassport(user, password)
              }
            })
            .catch(err => {
              result.error = err
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
