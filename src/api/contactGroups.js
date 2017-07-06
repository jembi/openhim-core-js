import Q from "q";
import logger from "winston";
import { ContactGroup } from "../model/contactGroups";
import * as authorisation from "./authorisation";
import { Channel } from "../model/channels";

import * as utils from "../utils";

export function* addContactGroup() {
    // Must be admin
  if (!authorisation.inGroup("admin", this.authenticated)) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to addContactGroup denied.`, "info");
    return;
  }

  const contactGroupData = this.request.body;

  try {
    const contactGroup = new ContactGroup(contactGroupData);
    const result = yield Q.ninvoke(contactGroup, "save");

    return utils.logAndSetResponse(this, 201, "Contact Group successfully created", "info");
  } catch (err) {
    return utils.logAndSetResponse(this, 400, `Could not add a contact group via the API: ${err}`, "error");
  }
}


export function* getContactGroup(contactGroupId) {
    // Must be admin
  if (!authorisation.inGroup("admin", this.authenticated)) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to getContactGroup denied.`, "info");
    return;
  }

  contactGroupId = unescape(contactGroupId);

  try {
    const result = yield ContactGroup.findById(contactGroupId).exec();

    if (result === null) {
      this.body = `Contact Group with id '${contactGroupId}' could not be found.`;
      return this.status = 404;
    } else {
      return this.body = result;
    }
  } catch (err) {
    return utils.logAndSetResponse(this, 500, `Could not find Contact Group by id '${contactGroupId}' via the API: ${err}`, "error");
  }
}

export function* updateContactGroup(contactGroupId) {
    // Must be admin
  if (!authorisation.inGroup("admin", this.authenticated)) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to updateContactGroup denied.`, "info");
    return;
  }

  contactGroupId = unescape(contactGroupId);
  const contactGroupData = this.request.body;

    // Ignore _id if it exists, a user shouldnt be able to update the internal id
  if (contactGroupData._id) {
    delete contactGroupData._id;
  }

  try {
    yield ContactGroup.findByIdAndUpdate(contactGroupId, contactGroupData).exec();
    this.body = "Successfully updated contact group.";
    return logger.info(`User ${this.authenticated.email} updated contact group with id ${contactGroupId}`);
  } catch (err) {
    return utils.logAndSetResponse(this, 500, `Could not update Contact Group by id ${contactGroupId} via the API: ${err}`, "error");
  }
}

export function* removeContactGroup(contactGroupId) {
    // Must be admin
  if (!authorisation.inGroup("admin", this.authenticated)) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to removeContactGroup denied.`, "info");
    return;
  }

  contactGroupId = unescape(contactGroupId);
  try {
    const linkedAlerts = yield Channel.find({
      alerts: {
        $elemMatch: {
          groups: {
            $in: [contactGroupId]
          }
        }
      }
    }).exec();
    if (linkedAlerts.length > 0) {
      this.status = 409;
      this.body = linkedAlerts;
    } else {
      yield ContactGroup.findByIdAndRemove(contactGroupId).exec();
      this.body = `Successfully removed contact group with ID '${contactGroupId}'`;
      logger.info(`User ${this.authenticated.email} removed contact group with id ${contactGroupId}`);
    }
  } catch (err) {
    utils.logAndSetResponse(this, 500, `Could not remove Contact Group by id ${contactGroupId} via the API: ${err}`, "error");
  }
}

export function* getContactGroups() {
    // Must be admin
  if (!authorisation.inGroup("admin", this.authenticated)) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to getContactGroups denied.`, "info");
    return;
  }

  try {
    return this.body = yield ContactGroup.find().exec();
  } catch (err) {
    return utils.logAndSetResponse(this, 500, `Could not fetch all Contact Group via the API: ${err}`, "error");
  }
}
