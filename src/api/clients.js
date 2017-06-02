import { Client } from '../model/clients';
import { Channel } from '../model/channels';
import Q from 'q';
import logger from 'winston';
import authorisation from './authorisation';
import utils from '../utils';

/*
 * Adds a client
 */
export function addClient() {

  // Test if the user is authorised
  if (!authorisation.inGroup('admin', this.authenticated)) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to addClient denied.`, 'info');
    return;
  }

  let clientData = this.request.body;

  if (clientData.clientID) {
    let chResult = {}; //TODO:Fix yield Channel.find({allow: {$in: [clientData.clientID]}}, {name: 1 }).exec()
    let clResult = {}; //TODO:Fix yield Client.find({roles: {$in: [clientData.clientID]}}, {clientID: 1 }).exec()
    if (((chResult != null ? chResult.length : undefined) > 0) || ((clResult != null ? clResult.length : undefined) > 0)) {
      return utils.logAndSetResponse(this, 409, `A role name conflicts with clientID '${clientData.clientID}'. A role name cannot be the same as a clientID.`, 'info');
    }
  }

  try {
    let client = new Client(clientData);
    let result = {}; //TODO:Fix yield Q.ninvoke client, 'save'

    logger.info(`User ${this.authenticated.email} created client with id ${client.id}`);
    this.body = 'Client successfully created';
    return this.status = 201;
  } catch (e) {
    logger.error(`Could not add a client via the API: ${e.message}`);
    this.body = e.message;
    return this.status = 400;
  }
}

/*
 * Retrieves the details of a specific client
 */
export function getClient(clientId, property) {
  let projectionRestriction = null;

  // if property - Setup client projection and bypass authorization
  if (typeof property === 'string') {
    if (property === 'clientName') {
      projectionRestriction = {
        _id: 0,
        name: 1
      };
    } else {
      utils.logAndSetResponse(this, 404, `The property (${property}) you are trying to retrieve is not found.`, 'info');
      return;
    }
  } else {
    // Test if the user is authorised
    if (!authorisation.inGroup('admin', this.authenticated)) {
      utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to findClientById denied.`, 'info');
      return;
    }
  }

  clientId = unescape(clientId);

  try {
    let result = {}; //TODO:Fix yield Client.findById(clientId, projectionRestriction).exec()
    if (result === null) {
      return utils.logAndSetResponse(this, 404, `Client with id ${clientId} could not be found.`, 'info');
    } else {
      return this.body = result;
    }
  } catch (e) {
    logger.error(`Could not find client by id ${clientId} via the API: ${e.message}`);
    this.body = e.message;
    return this.status = 500;
  }
}


export function findClientByDomain(clientDomain) {

  // Test if the user is authorised
  if (!authorisation.inGroup('admin', this.authenticated)) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to findClientByDomain denied.`, 'info');
    return;
  }

  clientDomain = unescape(clientDomain);

  try {
    let result = {}; //TODO:Fix yield Client.findOne(clientDomain: clientDomain).exec()
    if (result === null) {
      return utils.logAndSetResponse(this, 404, `Could not find client with clientDomain ${clientDomain}`, 'info');
    } else {
      return this.body = result;
    }
  } catch (e) {
    logger.error(`Could not find client by client Domain ${clientDomain} via the API: ${e.message}`);
    this.body = e.message;
    return this.status = 500;
  }
}

export function updateClient(clientId) {

  // Test if the user is authorised
  if (!authorisation.inGroup('admin', this.authenticated)) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to updateClient denied.`, 'info');
    return;
  }

  clientId = unescape(clientId);
  let clientData = this.request.body;

  // Ignore _id if it exists, a user shouldn't be able to update the internal id
  if (clientData._id) { delete clientData._id; }

  if (clientData.clientID) {
    let chResult = {}; //TODO:Fix yield Channel.find({allow: {$in: [clientData.clientID]}}, {name: 1 }).exec()
    let clResult = {}; //TODO:Fix yield Client.find({roles: {$in: [clientData.clientID]}}, {clientID: 1 }).exec()
    if (((chResult != null ? chResult.length : undefined) > 0) || ((clResult != null ? clResult.length : undefined) > 0)) {
      return utils.logAndSetResponse(this, 409, `A role name conflicts with clientID '${clientData.clientID}'. A role name cannot be the same as a clientID.`, 'info');
    }
  }

  try {
    ({}); //TODO:Fix yield Client.findByIdAndUpdate(clientId, clientData).exec()
    logger.info(`User ${this.authenticated.email} updated client with id ${clientId}`);
    return this.body = 'Successfully updated client.';
  } catch (e) {
    logger.error(`Could not update client by ID ${clientId} via the API: ${e.message}`);
    this.body = e.message;
    return this.status = 500;
  }
}

export function removeClient(clientId) {

  // Test if the user is authorised
  if (!authorisation.inGroup('admin', this.authenticated)) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to removeClient denied.`, 'info');
    return;
  }

  clientId = unescape(clientId);

  try {
    ({}); //TODO:Fix yield Client.findByIdAndRemove(clientId).exec()
    this.body = `Successfully removed client with ID ${clientId}`;
    return logger.info(`User ${this.authenticated.email} removed client with id ${clientId}`);
  } catch (e) {
    logger.error(`Could not remove client by ID ${clientId} via the API: ${e.message}`);
    this.body = e.message;
    return this.status = 500;
  }
}

export function getClients() {

  // Test if the user is authorised
  if (!authorisation.inGroup('admin', this.authenticated)) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to getClients denied.`, 'info');
    return;
  }

  try {
    return this.body = {}; //TODO:Fix yield Client.find().exec()
  } catch (e) {
    logger.error(`Could not fetch all clients via the API: ${e.message}`);
    this.message = e.message;
    return this.status = 500;
  }
}
