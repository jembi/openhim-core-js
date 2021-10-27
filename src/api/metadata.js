'use strict'
import logger from 'winston'
import * as authorisation from './authorisation'
import * as utils from '../utils'
import {ChannelModelAPI} from '../model/channels'
import {ClientModelAPI} from '../model/clients'
import {ContactGroupModelAPI} from '../model/contactGroups'
import {KeystoreModelAPI} from '../model/keystore'
import {MediatorModelAPI} from '../model/mediators'
import {UserModelAPI} from '../model/users'
import {getClients, addClient, updateClient, getClientByTextClientId} from '../api/clients'
import {getChannels, addChannel, updateChannel, getChannelByName} from '../api/channels'
import * as polling from '../polling'
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
function removeProperties(obj) {
  try{
    console.log("object passed to the removeProperties Function: " + JSON.stringify(obj));
    const propertyID = '_id'
    const propertyV = '__v'
    for (const prop in obj) {
     
      if (prop === propertyID || prop === propertyV) {
        delete obj[prop];
      } else if (typeof obj[prop] === 'object' || obj[prop] instanceof Array) {
         console.log("object with property to be passed in recursion : " + JSON.stringify(obj));
         console.log("property to be deleted : " + JSON.stringify(obj[prop]));
         removeProperties(obj[prop])
      }
    }
    return obj;
  } catch(e) {
    console.log("object throwing the exception: " + JSON.stringify(obj));
    console.log(e);
    return obj;
  }
}
// Function to return unique identifier key and value for a collection
function getUniqueIdentifierForCollection(collection, doc) {
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
      logger.debug(
        `Unhandeled case for ${collection} in getUniqueIdentifierForCollection`
      )
      break
  }
  const returnObj = {}
  returnObj[uidKey] = uid
  return returnObj
}
// Build response object
function buildResponseObject(model, doc, status, message, uid) {
  return {
    model,
    record: doc,
    status,
    message,
    uid
  }
}
// API endpoint that returns metadata for export
export async function getMetadata(ctx) {
  // Test if the user is authorised
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    return utils.logAndSetResponse(
      ctx,
      403,
      `User ${ctx.authenticated.email} is not an admin, API access to getMetadata denied.`,
      'info'
    )
  }
  try {
    const exportObject = {}
    // Return all documents from all collections for export
    for (const model in collections) {
      switch(model) {
        case 'Clients':
          await getClients(ctx);
          exportObject[model] = ctx.body;
          break;
        case 'Channels':
          await getChannels(ctx);
           var resultDbCall = await collections[model].find().lean().exec();
           console.log("Calling the direct database call");
           console.log("Result passed from the direct db call Method: " + JSON.stringify(resultDbCall));
           resultDbCall = removeProperties(resultDbCall);
           console.log("Remove properties after the database call");
           console.log("Result of Remove properties after the database call: " + JSON.stringify(resultDbCall));
           console.log("Result passed from the getChannels Method: " + JSON.stringify(ctx.body));
          exportObject[model] = ctx.body; 
          break; 
        default:
          exportObject[model] = await collections[model].find().lean().exec();
          break;
      }
      for (let doc of Array.from(exportObject[model])) {
        if (doc._id) {
         // doc = removeProperties(doc)
        }
      }
    }
    ctx.body = [exportObject]
    ctx.status = 200
  } catch (e) {
    console.log(e);
    ctx.body = e.message
    utils.logAndSetResponse(
      ctx,
      500,
      `Could not fetch specified metadata via the API ${e}`,
      'error'
    )
  }
}

function docExists(doc) {
  return doc && doc._id;
}
function validateDocument(key, doc, ctx) {
  doc = new collections[key](doc)
  doc.set('updatedBy', utils.selectAuditFields(ctx.authenticated))
  const error = doc.validateSync()
  if (error) {
    throw new Error(`Document Validation failed: ${error}`)
  }
}
async function handleMetadataPost(ctx, action) {
  // Test if the user is authorised
  if (!authorisation.inGroup('admin', ctx.authenticated)) {
    return utils.logAndSetResponse(
      ctx,
      403,
      `User ${ctx.authenticated.email} is not an admin, API access to importMetadata denied.`,
      'info'
    )
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
          if(key === 'Clients') {
             await getClientByTextClientId(ctx, doc.clientID);
             const clientResult = ctx.body;
            const modelCtx = ctx;
            modelCtx.request.body = doc;
            if(action === 'import') {
              if (docExists(clientResult)) {
                await updateClient(modelCtx, clientResult._id);
                status = 'Updated';
              }
              else {
                ctx.request.body = doc;
                await addClient(modelCtx); 
                status = 'Inserted';
              }
            }
            if(action === 'validate') {
              if (docExists(clientResult)) {
                status = 'Conflict';
              }
              else {
                validateDocument(key, doc, ctx);
                status = 'Valid'
              }
            }
          }
          else if(key === 'Channels') {
            await getChannelByName(ctx, doc.name);
            const channelResult =ctx.body;
            const modelCtx = ctx;
            modelCtx.request.body = doc;
            if(action === 'import') {
              if (docExists(channelResult)) {
                await updateChannel(modelCtx, channelResult._id);
                status = 'Updated';
              }
              else {
                ctx.request.body = doc;
                await addChannel(modelCtx); 
                status = 'Inserted';
              }
            }
            if(action === 'validate') {
              if (docExists(channelResult)) {
                status = 'Conflict';
              }
              else {
                validateDocument(key, doc, ctx);
                status = 'Valid'
              }
            }
          }
          else {
            if (action === 'import') {
              if (result && result.length > 0 && result[0]._id) {
                if (doc._id) {
                  delete doc._id
                }
                result = await collections[key].findById(result[0]._id).exec()
                result.set(doc)
                result.set(
                  'updatedBy',
                  utils.selectAuditFields(ctx.authenticated)
                )
                result = await result.save()
                status = 'Updated'
              } else {
                doc = new collections[key](doc)
                doc.set('updatedBy', utils.selectAuditFields(ctx.authenticated))
                result = await doc.save()
                status = 'Inserted'
              }
              // Ideally we should rather use our APIs to insert object rather than go directly to the DB
              // Then we would have to do this sort on thing as it's already covered there.
              // E.g. https://github.com/jembi/openhim-core-js/blob/cd7d1fbbe0e122101186ecba9cf1de37711580b8/src/api/channels.js#L241-L257
              if (
                key === 'Channels' &&
                result.type === 'polling' &&
                result.status === 'enabled'
              ) {
                polling.registerPollingChannel(result, err => {
                  logger.error(err)
                })
              }
            }
            if (action === 'validate') {
              if (result && result.length > 0 && result[0]._id) {
                status = 'Conflict'
              } else {
                validateDocument(key, doc, ctx);
                status = 'Valid'
              }
            }
          }
          logger.info(
            `User ${ctx.authenticated.email} performed ${action} action on ${key}, got ${status}`
          )
          returnObject.push(buildResponseObject(key, doc, status, '', uid))
        } catch (err) {
          logger.error(
            `Failed to ${action} ${key} with unique identifier ${uid}. ${err.message}`
          )
          returnObject.push(
            buildResponseObject(key, doc, 'Error', err.message, uid)
          )
        }
      }
    }
    ctx.body = returnObject
    ctx.status = 201
  } catch (error2) {
    ctx.body = error2.message
    utils.logAndSetResponse(
      ctx,
      500,
      `Could not import metadata via the API ${error2}`,
      'error'
    )
  }
}
// API endpoint that upserts metadata
export async function importMetadata(ctx) {
  return handleMetadataPost(ctx, 'import')
}
// API endpoint that checks for conflicts between import object and database
export async function validateMetadata(ctx) {
  return handleMetadataPost(ctx, 'validate')
}
if (process.env.NODE_ENV === 'test') {
  exports.buildResponseObject = buildResponseObject
  exports.getUniqueIdentifierForCollection = getUniqueIdentifierForCollection
  exports.removeProperties = removeProperties
}