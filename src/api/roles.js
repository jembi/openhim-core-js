import logger from "winston";
import { Channel } from "../model/channels";
import { Client } from "../model/clients";
import * as authorisation from "./authorisation";
import * as utils from "../utils";

/*
 * Roles is a virtual API; virtual in the sense that it is not linked
 * to a concrete roles collection.
 *
 * Rather it an abstraction of the 'allow' field on Channels and 'roles' on Clients,
 * providing a mechanism for setting up allowed permissions.
 */


function filterRolesFromChannels(channels, clients) {
  let cl;
  let permission;
  const rolesMap = {}; // K: permission, V: channels, clients that share permission

  for (const ch of Array.from(channels)) {
    for (permission of Array.from(ch.allow)) {
      let isClient = false;
      for (cl of Array.from(clients)) {
        if (cl.clientID === permission) {
          isClient = true;
        }
      }

      if (!isClient) {
        if (!rolesMap[permission]) {
          rolesMap[permission] = {
            channels: [],
            clients: []
          };
        }
        rolesMap[permission].channels.push({ _id: ch._id, name: ch.name });
      }
    }
  }

  for (cl of Array.from(clients)) {
    for (permission of Array.from(cl.roles)) {
      if (!rolesMap[permission]) {
        rolesMap[permission] = {
          channels: [],
          clients: []
        };
      }
      rolesMap[permission].clients.push({ _id: cl._id, clientID: cl.clientID });
    }
  }

  const rolesArray = [];
  for (const role in rolesMap) {
    rolesArray.push({
      name: role,
      channels: rolesMap[role].channels,
      clients: rolesMap[role].clients
    });
  }

  return rolesArray;
}


export function* getRoles() {
    // Test if the user is authorised
  if (!authorisation.inGroup("admin", this.authenticated)) {
    return utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to getRoles denied.`, "info");
  }

  try {
    const channels = yield Channel.find({}, { name: 1, allow: 1 }).exec();
    const clients = yield Client.find({}, { clientID: 1, roles: 1 }).exec();

    return this.body = filterRolesFromChannels(channels, clients);
  } catch (e) {
    logger.error(`Could not fetch roles via the API: ${e.message}`);
    this.message = e.message;
    return this.status = 500;
  }
}


export function* getRole(name) {
    // Test if the user is authorised
  if (!authorisation.inGroup("admin", this.authenticated)) {
    return utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to getRole denied.`, "info");
  }

  try {
    const channels = yield Channel.find({ allow: { $in: [name] } }, { name: 1 }).exec();
    const clients = yield Client.find({ roles: { $in: [name] } }, { clientID: 1 }).exec();
    if ((channels === null || channels.length === 0) && (clients === null || clients.length === 0)) {
      return utils.logAndSetResponse(this, 404, `Role with name '${name}' could not be found.`, "info");
    } else {
      return this.body = {
        name,
        channels: channels.map(r => ({ _id: r._id, name: r.name })),
        clients: clients.map(c => ({ _id: c._id, clientID: c.clientID }))
      };
    }
  } catch (e) {
    logger.error(`Could not find role with name '${name}' via the API: ${e.message}`);
    this.body = e.message;
    return this.status = 500;
  }
}


function buildFindChannelByIdOrNameCriteria(ctx, role) {
  let criteria = {};
  const ids = [];
  const names = [];
  for (const ch of Array.from(role.channels)) {
    if (ch._id) {
      ids.push(ch._id);
    } else if (ch.name) {
      names.push(ch.name);
    } else {
      utils.logAndSetResponse(ctx, 400, "_id and/or name must be specified for a channel", "info");
      return null;
    }
  }

  if ((ids.length > 0) && (names.length > 0)) {
    criteria = {
      $or: [
                { _id: { $in: ids } },

                { name: { $in: names } }
      ]
    };
  } else {
    if (ids.length > 0) {
      criteria._id = { $in: ids };
    }
    if (names.length > 0) {
      criteria.name = { $in: names };
    }
  }

  return criteria;
}

function buildFindClientByIdOrClientIDCriteria(ctx, role) {
  let criteria = {};
  const ids = [];
  const clientIDs = [];
  for (const ch of Array.from(role.clients)) {
    if (ch._id) {
      ids.push(ch._id);
    } else if (ch.clientID) {
      clientIDs.push(ch.clientID);
    } else {
      utils.logAndSetResponse(ctx, 400, "_id and/or clientID must be specified for a client", "info");
      return null;
    }
  }

  if ((ids.length > 0) && (clientIDs.length > 0)) {
    criteria = {
      $or: [
                { _id: { $in: ids } },

                { clientID: { $in: clientIDs } }
      ]
    };
  } else {
    if (ids.length > 0) {
      criteria._id = { $in: ids };
    }
    if (clientIDs.length > 0) {
      criteria.clientID = { $in: clientIDs };
    }
  }

  return criteria;
}


export function* addRole() {
    // Test if the user is authorised
  if (!authorisation.inGroup("admin", this.authenticated)) {
    return utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to addRole denied.`, "info");
  }

  const role = this.request.body;
  if (!role.name) {
    return utils.logAndSetResponse(this, 400, "Must specify a role name", "info");
  }
  if (((role.channels != null ? role.channels.length : undefined) === 0) && ((role.clients != null ? role.clients.length : undefined) === 0)) {
    return utils.logAndSetResponse(this, 400, "Must specify at least one channel or client to link the role to", "info");
  }

  try {
    const chResult = yield Channel.find({ allow: { $in: [role.name] } }, { name: 1 }).exec();
    const clResult = yield Client.find({ roles: { $in: [role.name] } }, { clientID: 1 }).exec();
    if (((chResult != null ? chResult.length : undefined) > 0) || ((clResult != null ? clResult.length : undefined) > 0)) {
      return utils.logAndSetResponse(this, 400, `Role with name '${role.name}' already exists.`, "info");
    }

    const clientConflict = yield Client.find({ clientID: role.name }, { clientID: 1 }).exec();
    if ((clientConflict != null ? clientConflict.length : undefined) > 0) {
      return utils.logAndSetResponse(this, 409, `A clientID conflicts with role name '${role.name}'. A role name cannot be the same as a clientID.`, "info");
    }

        // TODO : This needs a bit of a refactor
    let chCriteria;
    if (role.channels) {
      chCriteria = buildFindChannelByIdOrNameCriteria(this, role);
      if (!chCriteria) { return; }
    }

    let clCriteria;
    if (role.clients) {
      clCriteria = buildFindClientByIdOrClientIDCriteria(this, role);
      if (!clCriteria) { return; }
    }

    if (role.channels) {
      yield Channel.update(chCriteria, { $push: { allow: role.name } }, { multi: true }).exec();
    }
    if (role.clients) {
      yield Client.update(clCriteria, { $push: { roles: role.name } }, { multi: true }).exec();
    }

    logger.info(`User ${this.authenticated.email} setup role '${role.name}'`);
    this.body = "Role successfully created";
    return this.status = 201;
  } catch (e) {
    logger.error(`Could not add a role via the API: ${e.message}`);
    this.body = e.message;
    return this.status = 400;
  }
}


export function* updateRole(name) {
    // Test if the user is authorised
  if (!authorisation.inGroup("admin", this.authenticated)) {
    return utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to updateRole denied.`, "info");
  }

  const role = this.request.body;

  try {
        // request validity checks
    let channels;
    let clients;
    const chResult = yield Channel.find({ allow: { $in: [name] } }, { name: 1 }).exec();
    const clResult = yield Client.find({ roles: { $in: [name] } }, { clientID: 1 }).exec();
    if ((chResult === null || chResult.length === 0) && (clResult === null || clResult.length === 0)) {
      return utils.logAndSetResponse(this, 404, `Role with name '${name}' could not be found.`, "info");
    }

    if (role.name) {
            // do check here but only perform rename updates later after channel/client updates
      channels = yield Channel.find({ allow: { $in: [role.name] } }, { name: 1 }).exec();
      clients = yield Client.find({ roles: { $in: [role.name] } }, { name: 1 }).exec();
      if ((channels != null ? channels.length : undefined) > 0 || (clients != null ? clients.length : undefined > 0)) {
        return utils.logAndSetResponse(this, 400, `Role with name '${role.name}' already exists.`, "info");
      }

      const clientConflict = yield Client.find({ clientID: role.name }, { clientID: 1 }).exec();
      if (clientConflict != null ? clientConflict.length : undefined > 0) {
        return utils.logAndSetResponse(this, 409, `A clientID conflicts with role name '${role.name}'. A role name cannot be the same as a clientID.`, "info");
      }
    }

        // TODO : refactor this
    let chCriteria;
    if (role.channels) {
      chCriteria = buildFindChannelByIdOrNameCriteria(this, role);
      if (!chCriteria) { return; }
    }

    let clCriteria;
    if (role.clients) {
      clCriteria = buildFindClientByIdOrClientIDCriteria(this, role);
      if (!clCriteria) { return; }
    }

        // update channels
    if (role.channels) {
            // clear role from existing
      yield Channel.update({}, { $pull: { allow: name } }, { multi: true }).exec();
            // set role on channels
      if (role.channels.length > 0) {
        yield Channel.update(chCriteria, { $push: { allow: name } }, { multi: true }).exec();
      }
    }

        // update clients
    if (role.clients) {
            // clear role from existing
      yield Client.update({}, { $pull: { roles: name } }, { multi: true }).exec();
            // set role on clients
      if ((role.clients != null ? role.clients.length : undefined) > 0) {
        yield Client.update(clCriteria, { $push: { roles: name } }, { multi: true }).exec();
      }
    }

        // rename role
    if (role.name) {
      yield Channel.update({ allow: { $in: [name] } }, { $push: { allow: role.name } }, { multi: true }).exec();
      yield Channel.update({ allow: { $in: [name] } }, { $pull: { allow: name } }, { multi: true }).exec();
      yield Client.update({ roles: { $in: [name] } }, { $push: { roles: role.name } }, { multi: true }).exec();
      yield Client.update({ roles: { $in: [name] } }, { $pull: { roles: name } }, { multi: true }).exec();
    }

    logger.info(`User ${this.authenticated.email} updated role with name '${name}'`);
    this.body = "Successfully updated role";
    return this.status = 200;
  } catch (e) {
    logger.error(`Could not update role with name '${name}' via the API: ${e.message}`);
    this.body = e.message;
    return this.status = 500;
  }
}


export function* deleteRole(name) {
    // Test if the user is authorised
  if (!authorisation.inGroup("admin", this.authenticated)) {
    return utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to updateRole denied.`, "info");
  }

  try {
    const channels = yield Channel.find({ allow: { $in: [name] } }, { name: 1 }).exec();
    const clients = yield Client.find({ roles: { $in: [name] } }, { clientID: 1 }).exec();
    if ((channels === null || channels.length === 0) && (clients === null || clients.length === 0)) {
      return utils.logAndSetResponse(this, 404, `Role with name '${name}' could not be found.`, "info");
    }

    yield Channel.update({}, { $pull: { allow: name } }, { multi: true }).exec();
    yield Client.update({}, { $pull: { roles: name } }, { multi: true }).exec();

    logger.info(`User ${this.authenticated.email} deleted role with name '${name}'`);
    return this.body = "Successfully deleted role";
  } catch (e) {
    logger.error(`Could not update role with name '${name}' via the API: ${e.message}`);
    this.body = e.message;
    return this.status = 500;
  }
}
