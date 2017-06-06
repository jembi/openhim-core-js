// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import { Channel } from '../model/channels';
import { Client } from '../model/clients';
import { Mediator } from '../model/mediators';
import { User } from '../model/users';
import { ContactGroup } from '../model/contactGroups';
import { Keystore } from '../model/keystore';

import Q from 'q';
import logger from 'winston';
import authorisation from './authorisation';
import utils from "../utils";

// Map string parameters to collections
let collections = {
  Channels: Channel,
  Clients: Client,
  Mediators: Mediator,
  Users: User,
  ContactGroups: ContactGroup,
  Keystore
};


//Function to remove properties from export object
function removeProperties (obj) {
  let propertyID = '_id';
  let propertyV = '__v';

  for (let prop in obj) {
    if ((prop === propertyID) || (prop === propertyV)) {
      delete obj[prop];
    } else if ( (typeof obj[prop] === 'object') || obj[prop] instanceof Array ) {
      removeProperties(obj[prop]);
    }
  }
  return obj;
};


// Function to return unique identifier key and value for a collection
 function getUniqueIdentifierForCollection(collection, doc) {
  let uid, uidKey;
  switch (collection) {
    case 'Channels': uidKey = 'name'; uid = doc.name; break;
    case 'Clients': uidKey = 'clientID'; uid = doc.clientID; break;
    case 'Mediators': uidKey = 'urn'; uid = doc.urn; break;
    case 'Users': uidKey = 'email'; uid = doc.email; break;
    case 'ContactGroups': uidKey = 'groups'; uid = doc.groups; break;
  }
  let returnObj = {};
  returnObj[uidKey] = uid;
  return returnObj;
};


// Build response object
let buildResponseObject = (model, doc, status, message, uid) =>
  ({
    model,
    record: doc,
    status,
    message,
    uid
  })
;
  

// API endpoint that returns metadata for export
export function getMetadata() {
  // Test if the user is authorised
  if (!authorisation.inGroup('admin', this.authenticated)) {
    return utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to getMetadata denied.`, 'info');
  }

  try {
    let exportObject = {};
    let params = this.request.query;
    
    // Return all documents from all collections for export
    for (let col in collections) {
      exportObject[col] = {}; //TODO:Fix yield collections[col].find().lean().exec()
      for (let doc of Array.from(exportObject[col])) {
        if (doc._id) {
          doc = removeProperties(doc);
        }
      }
    }

    this.body = [exportObject];
    return this.status = 200;
  } catch (e) {
    this.body = e.message;
    return utils.logAndSetResponse(this, 500, `Could not fetch specified metadata via the API ${e}`, 'error');
  }
}


 function handleMetadataPost(action, that) {
  // Test if the user is authorised
  let e;
  if (!authorisation.inGroup('admin', that.authenticated)) {
    return utils.logAndSetResponse(that, 403, `User ${that.authenticated.email} is not an admin, API access to importMetadata denied.`, 'info');
  }

  try {
    let status;
    let returnObject = [];
    let insertObject = that.request.body;
    
    for (let key in insertObject) {
      let insertDocuments = insertObject[key];
      for (let doc of Array.from(insertDocuments)) {
        var error, uid;
        try {
          var result;
          if (!(key in collections)) {
            throw new Error("Invalid Collection in Import Object");
          }
          
          // Keystore model does not have a uid other than _id and may not contain more than one entry
          if (key === 'Keystore') {
            result = {}; //TODO:Fix yield collections[key].find().exec()
            uid = '';
          } else {
            let uidObj = getUniqueIdentifierForCollection(key, doc);
            uid = uidObj[Object.keys(uidObj)[0]];
            result = {}; //TODO:Fix yield collections[key].find(uidObj).exec()
          }
          
          if (action === 'import') {
            if (result && (result.length > 0) && result[0]._id) {
              if (doc._id) { delete doc._id; }
              ({}); //TODO:Fix yield collections[key].findByIdAndUpdate(result[0]._id, doc).exec()
              status = 'Updated';
            } else {
              doc = new (collections[key])(doc);
              result = {}; //TODO:Fix yield Q.ninvoke doc, 'save'
              status = 'Inserted';
            }
          }
          
          if (action === 'validate') {
            if (result && (result.length > 0) && result[0]._id) {
              status = 'Conflict';
            } else {
              doc = new (collections[key])(doc);
              error = doc.validateSync();
              if (error) {
                throw new Error(`Document Validation failed: ${error}`);
              }
              status = 'Valid';
            }
          }
          
          logger.info(`User ${that.authenticated.email} performed ${action} action on ${key}, got ${status}`);
          returnObject.push(buildResponseObject(key, doc, status, '', uid));
          
        } catch (error1) {
          e = error1;
          logger.error(`Failed to ${action} ${key} with unique identifier ${uid}. ${e.message}`);
          returnObject.push(buildResponseObject(key, doc, 'Error', e.message, uid));
        }
      }
    }
        
    that.body = returnObject;
    return that.status = 201;
  } catch (error2) {
    e = error2;
    that.body = e.message;
    return utils.logAndSetResponse(that, 500, `Could not import metadata via the API ${e}`, 'error');
  }
};


// API endpoint that upserts metadata
export function importMetadata() {
  return handleMetadataPost('import', this);
}
  
// API endpoint that checks for conflicts between import object and database
export function validateMetadata() {
  return handleMetadataPost('validate', this);
}

if (process.env.NODE_ENV === "test") {
  exports.buildResponseObject = buildResponseObject;
  exports.getUniqueIdentifierForCollection = getUniqueIdentifierForCollection;
  exports.removeProperties = removeProperties;
}
