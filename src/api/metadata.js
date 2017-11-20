import logger from 'winston'
import * as authorisation from './authorisation'
import * as utils from '../utils'
import { ChannelModelAPI } from '../model/channels'
import { ClientModelAPI } from '../model/clients'
import { MediatorModelAPI } from '../model/mediators'
import { UserModelAPI } from '../model/users'
import { ContactGroupModelAPI } from '../model/contactGroups'
import { KeystoreModelAPI } from '../model/keystore'

// Map string parameters to collections
const collections = {
  Channels: ChannelModelAPI,
  Clients: ClientModelAPI,
  Mediators: MediatorModelAPI,
  Users: UserModelAPI,
  ContactGroups: ContactGroupModelAPI,
  KeystoreModelAPI
}

// Function to remove properties from export object
function removeProperties (obj) {
  const propertyID = '_id'
  const propertyV = '__v'

  for (const prop in obj) {
    if ((prop === propertyID) || (prop === propertyV)) {
      delete obj[prop]
    } else if ((typeof obj[prop] === 'object') || obj[prop] instanceof Array) {
      removeProperties(obj[prop])
    }
  }
  return obj
}

// Function to return unique identifier key and value for a collection
function getUniqueIdentifierForCollection (collection, doc) {
  let uid
  let uidKey
  switch (collection) {
    case 'Channels':
      uidKey = 'name'
      uid = doc.name
      break
    case 'Clients':
      uidKey = 'clientID'
      uid = doc.clientID
      break
    case 'Mediators':
      uidKey = 'urn'
      uid = doc.urn
      break
    case 'Users':
      uidKey = 'email'
      uid = doc.email
      break
    case 'ContactGroups':
      uidKey = 'groups'
      uid = doc.groups
      break
    default:
      logger.debug(`Unhandeled case for ${collection} in getUniqueIdentifierForCollection`)
      break
  }
  const returnObj = {}
  returnObj[uidKey] = uid
  return returnObj
}

// Build response object
function buildResponseObject (model, doc, status, message, uid) {
  return {
    model,
    record: doc,
    status,
    message,
    uid
  }
}

// API endpoint that returns metadata for export
export async function getMetadata (ctx) {
  // Test if the user is authorised
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    return utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to getMetadata denied.`, 'info')
  }

  try {
    const exportObject = {}

    // Return all documents from all collections for export
    for (const col in collections) {
      exportObject[col] = await collections[col].find().lean().exec()
      for (let doc of Array.from(exportObject[col])) {
        if (doc._id) {
          doc = removeProperties(doc)
        }
      }
    }

    ctx.body = [exportObject]
    ctx.status = 200
  } catch (e) {
    ctx.body = e.message
    utils.logAndSetResponse(ctx, 500, `Could not fetch specified metadata via the API ${e}`, 'error')
  }
}

async function handleMetadataPost (ctx, action) {
  // Test if the user is authorised
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    return utils.logAndSetResponse(ctx, 403, `User ${ctx.authenticated.email} is not an admin, API access to importMetadata denied.`, 'info')
  }

  try {
    let status
    const returnObject = []
    const insertObject = ctx.request.body

    for (const key in insertObject) {
      const insertDocuments = insertObject[key]
      for (let doc of Array.from(insertDocuments)) {
        let error
        let uid
        try {
          let result
          if (!(key in collections)) {
            throw new Error('Invalid Collection in Import Object')
          }

          // Keystore model does not have a uid other than _id and may not contain more than one entry
          if (key === 'Keystore') {
            result = await collections[key].find().exec()
            uid = ''
          } else {
            const uidObj = getUniqueIdentifierForCollection(key, doc)
            uid = uidObj[Object.keys(uidObj)[0]]
            result = await collections[key].find(uidObj).exec()
          }

          if (action === 'import') {
            if (result && (result.length > 0) && result[0]._id) {
              if (doc._id) { delete doc._id }
              result = await collections[key].findById(result[0]._id).exec()
              result.set(doc)
              result.set('updatedBy', utils.selectAuditFields(ctx.authenticated))
              await result.save()
              status = 'Updated'
            } else {
              doc = new (collections[key])(doc)
              doc.set('updatedBy', utils.selectAuditFields(ctx.authenticated))
              result = await doc.save()
              status = 'Inserted'
            }
          }

          if (action === 'validate') {
            if (result && (result.length > 0) && result[0]._id) {
              status = 'Conflict'
            } else {
              doc = new (collections[key])(doc)
              doc.set('updatedBy', utils.selectAuditFields(ctx.authenticated))
              error = doc.validateSync()
              if (error) {
                throw new Error(`Document Validation failed: ${error}`)
              }
              status = 'Valid'
            }
          }

          logger.info(`User ${ctx.authenticated.email} performed ${action} action on ${key}, got ${status}`)
          returnObject.push(buildResponseObject(key, doc, status, '', uid))
        } catch (err) {
          logger.error(`Failed to ${action} ${key} with unique identifier ${uid}. ${err.message}`)
          returnObject.push(buildResponseObject(key, doc, 'Error', err.message, uid))
        }
      }
    }

    ctx.body = returnObject
    ctx.status = 201
  } catch (error2) {
    ctx.body = error2.message
    utils.logAndSetResponse(ctx, 500, `Could not import metadata via the API ${error2}`, 'error')
  }
}

// API endpoint that upserts metadata
export async function importMetadata (ctx) {
  return handleMetadataPost(ctx, 'import')
}

// API endpoint that checks for conflicts between import object and database
export async function validateMetadata (ctx) {
  return handleMetadataPost(ctx, 'validate')
}

if (process.env.NODE_ENV === 'test') {
  exports.buildResponseObject = buildResponseObject
  exports.getUniqueIdentifierForCollection = getUniqueIdentifierForCollection
  exports.removeProperties = removeProperties
}
