import Q from "q";
import logger from "winston";
import moment from "moment";
import randtoken from "rand-token";
import atna from "atna-audit";
import os from "os";
import { User } from "../model/users";
import * as authorisation from "./authorisation";
import * as contact from "../contact";
import { config } from "../config";
import * as utils from "../utils";
import * as auditing from "../auditing";

config.newUserExpiry = config.get("newUserExpiry");
config.userPasswordResetExpiry = config.get("userPasswordResetExpiry");
config.alerts = config.get("alerts");

const himSourceID = config.get("auditing").auditEvents.auditSourceID;

/*
 * Get authentication details
 */
export function* authenticate(email) {
    email = unescape(email);

    try {
        const user = yield User.findOne({ email }).exec();

        if (!user) {
            utils.logAndSetResponse(this, 404, `Could not find user by email ${email}`, "info");
            // Audit unknown user requested
            let audit = atna.userLoginAudit(atna.OUTCOME_SERIOUS_FAILURE, himSourceID, os.hostname(), email);
            audit = atna.wrapInSyslog(audit);
            return auditing.sendAuditEvent(audit, () => logger.debug("Processed internal audit"));
        } else {
            return this.body = {
                salt: user.passwordSalt,
                ts: new Date()
            };
        }
    } catch (e) {
        return utils.logAndSetResponse(this, 500, `Error during authentication ${e}`, "error");
    }
}


/**
 * Reset password Functions
 */


const passwordResetPlainMessageTemplate = (firstname, setPasswordLink) => `\
<---------- Existing User - Reset Password ---------->
Hi ${firstname},

A request has been made to reset your password on the OpenHIM instance running on ${config.alerts.himInstance}
Follow the below link to reset your password and log into OpenHIM Console
${setPasswordLink}
<---------- Existing User - Reset Password ---------->\
`;

const passwordResetHtmlMessageTemplate = (firstname, setPasswordLink) => `\
<h1>Reset OpenHIM Password</h1>
<p>Hi ${firstname},<br/><br/>A request has been made to reset your password on the OpenHIM instance running on ${config.alerts.himInstance}</p>
<p>Follow the below link to set your password and log into OpenHIM Console</p>
<p>${setPasswordLink}</p>\
`;

export function generateRandomToken() {
    return randtoken.generate(32);
}

/*
 * update user token/expiry and send new password email
 */
export function* userPasswordResetRequest(email) {
    email = unescape(email);

    if (email === "root@openhim.org") {
        this.body = "Cannot request password reset for 'root@openhim.org'";
        this.status = 403;
        return;
    }

    // Generate the new user token here
    // set expiry date = true

    const token = exports.generateRandomToken();
    const { duration } = config.userPasswordResetExpiry;
    const { durationType } = config.userPasswordResetExpiry;
    const expiry = moment().add(duration, durationType).utc().format();

    const updateUserTokenExpiry = {
        token,
        tokenType: "existingUser",
        expiry
    };

    try {
        const user = yield User.findOneAndUpdate({ email }, updateUserTokenExpiry).exec();

        if (!user) {
            this.body = `Tried to request password reset for invalid email address: ${email}`;
            this.status = 404;
            logger.info(`Tried to request password reset for invalid email address: ${email}`);
            return;
        }

        const { consoleURL } = config.alerts;
        const setPasswordLink = `${consoleURL}/#/set-password/${token}`;

        // Send email to user to reset password
        const plainMessage = passwordResetPlainMessageTemplate(user.firstname, setPasswordLink);
        const htmlMessage = passwordResetHtmlMessageTemplate(user.firstname, setPasswordLink);

        const sendEmail = Q.denodeify(contact.contactUser);
        const sendEmailError = yield sendEmail("email", email, "OpenHIM Console Password Reset", plainMessage, htmlMessage);
        if (sendEmailError) {
            utils.logAndSetResponse(this, 500, `Could not send email to user via the API ${sendEmailError}`, "error");
        }

        logger.info("The email has been sent to the user");
        this.body = "Successfully set user token/expiry for password reset.";
        this.status = 201;
        return logger.info(`User updated token/expiry for password reset ${email}`);
    } catch (error) {
        return utils.logAndSetResponse(this, 500, `Could not update user with email ${email} via the API ${error}`, "error");
    }
}


/**
*New User Set Password Functions
 */

// get the new user details
export function* getUserByToken(token) {
    token = unescape(token);

    try {
        const projectionRestriction = { email: 1, firstname: 1, surname: 1, msisdn: 1, token: 1, tokenType: 1, locked: 1, expiry: 1, _id: 0 };

        const result = yield User.findOne({ token }, projectionRestriction).exec();
        if (!result) {
            this.body = `User with token ${token} could not be found.`;
            return this.status = 404;
        } else if (moment(result.expiry).isBefore(moment())) {
            // user- set password - expired
            this.body = `Token ${token} has expired`;
            return this.status = 410;
        } else {
            return this.body = result;
        }
    } catch (e) {
        return utils.logAndSetResponse(this, 500, `Could not find user with token ${token} via the API ${e}`, "error");
    }
}


// update the password/details for the new user
export function* updateUserByToken(token) {
    let e;
    let msisdn;
    let userDataExpiry;
    token = unescape(token);
    const userData = this.request.body;

    try {
        // first try get new user details to check expiry date
        userDataExpiry = yield User.findOne({ token }).exec();

        if (!userDataExpiry) {
            this.body = `User with token ${token} could not be found.`;
            this.status = 404;
            return;
        } else if (moment(userDataExpiry.expiry).isBefore(moment())) {
            // new user- set password - expired
            this.body = `User with token ${token} has expired to set their password.`;
            this.status = 410;
            return;
        }
    } catch (error) {
        e = error;
        utils.logAndSetResponse(this, 500, `Could not find user with token ${token} via the API ${e}`, "error");
        return;
    }

    // check to make sure 'msisdn' isnt 'undefined' when saving
    if (userData.msisdn) { ({ msisdn } = userData); } else { msisdn = null; }

    // construct user object to prevent other properties from being updated
    const userUpdateObj = {
        token: null,
        tokenType: null,
        expiry: null,
        passwordAlgorithm: userData.passwordAlgorithm,
        passwordSalt: userData.passwordSalt,
        passwordHash: userData.passwordHash
    };

    if (userDataExpiry.tokenType === "newUser") {
        userUpdateObj.firstname = userData.firstname;
        userUpdateObj.surname = userData.surname;
        userUpdateObj.locked = false;
        userUpdateObj.msisdn = msisdn;
    }

    try {
        yield User.findOneAndUpdate({ token }, userUpdateObj).exec();
        this.body = "Successfully set new user password.";
        return logger.info(`User updated by token ${token}`);
    } catch (error1) {
        e = error1;
        return utils.logAndSetResponse(this, 500, `Could not update user with token ${token} via the API ${e}`, "error");
    }
}


/**
 New User Set Password Functions
 */


const plainMessageTemplate = (firstname, setPasswordLink) => `\
<---------- New User - Set Password ---------->
Hi ${firstname},

A profile has been created for you on the OpenHIM instance running on ${config.alerts.himInstance}
Follow the below link to set your password and log into OpenHIM Console
${setPasswordLink}
<---------- New User - Set Password ---------->\
`;

const htmlMessageTemplate = (firstname, setPasswordLink) => `\
<h1>New OpenHIM Profile</h1>
<p>Hi ${firstname},<br/><br/>A profile has been created for you on the OpenHIM instance running on ${config.alerts.himInstance}</p>
<p>Follow the below link to set your password and log into OpenHIM Console</p>
<p>${setPasswordLink}</p>\
`;

/*
 * Adds a user
 */
export function* addUser() {
    // Test if the user is authorised
    if (!authorisation.inGroup("admin", this.authenticated)) {
        utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to addUser denied.`, "info");
        return;
    }

    const userData = this.request.body;

    // Generate the new user token here
    // set locked = true
    // set expiry date = true

    const token = randtoken.generate(32);
    userData.token = token;
    userData.tokenType = "newUser";
    userData.locked = true;

    const { duration } = config.newUserExpiry;
    const { durationType } = config.newUserExpiry;
    userData.expiry = moment().add(duration, durationType).utc().format();

    const { consoleURL } = config.alerts;
    const setPasswordLink = `${consoleURL}/#/set-password/${token}`;

    try {
        const user = new User(userData);
        const result = yield Q.ninvoke(user, "save");

        // Send email to new user to set password

        const plainMessage = plainMessageTemplate(userData.firstname, setPasswordLink);
        const htmlMessage = htmlMessageTemplate(userData.firstname, setPasswordLink);

        contact.contactUser("email", userData.email, "OpenHIM Console Profile", plainMessage, htmlMessage, (err) => {
            if (err) {
                return logger.error(`The email could not be sent to the user via the API ${err}`);
            } else {
                return logger.info("The email has been sent to the new user");
            }
        });

        this.body = "User successfully created";
        this.status = 201;
        return logger.info(`User ${this.authenticated.email} created user ${userData.email}`);
    } catch (e) {
        return utils.logAndSetResponse(this, 500, `Could not add user via the API ${e}`, "error");
    }
}


/*
 * Retrieves the details of a specific user
 */
export function* getUser(email) {
    email = unescape(email);

    // Test if the user is authorised, allow a user to fetch their own details
    if (!authorisation.inGroup("admin", this.authenticated) && (this.authenticated.email !== email)) {
        utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to getUser denied.`, "info");
        return;
    }

    try {
        const result = yield User.findOne({ email }).exec();
        if (!result) {
            this.body = `User with email ${email} could not be found.`;
            return this.status = 404;
        } else {
            return this.body = result;
        }
    } catch (e) {
        return utils.logAndSetResponse(this, 500, `Could not get user via the API ${e}`, "error");
    }
}


export function* updateUser(email) {
    email = unescape(email);

    // Test if the user is authorised, allow a user to update their own details
    if (!authorisation.inGroup("admin", this.authenticated) && (this.authenticated.email !== email)) {
        utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to updateUser denied.`, "info");
        return;
    }

    const userData = this.request.body;

    // reset token/locked/expiry when user is updated and password supplied
    if (userData.passwordAlgorithm && userData.passwordHash && userData.passwordSalt) {
        userData.token = null;
        userData.tokenType = null;
        userData.locked = false;
        userData.expiry = null;
    }

    // Don't allow a non-admin user to change their groups
    if ((this.authenticated.email === email) && !authorisation.inGroup("admin", this.authenticated)) { delete userData.groups; }

    // Ignore _id if it exists (update is by email)
    if (userData._id) { delete userData._id; }

    try {
        yield User.findOneAndUpdate({ email }, userData).exec();
        this.body = "Successfully updated user.";
        return logger.info(`User ${this.authenticated.email} updated user ${userData.email}`);
    } catch (e) {
        return utils.logAndSetResponse(this, 500, `Could not update user ${email} via the API ${e}`, "error");
    }
}


export function* removeUser(email) {
    // Test if the user is authorised
    if (!authorisation.inGroup("admin", this.authenticated)) {
        utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to removeUser denied.`, "info");
        return;
    }

    email = unescape(email);

    // Test if the user is root@openhim.org
    if (email === "root@openhim.org") {
        utils.logAndSetResponse(this, 403, "User root@openhim.org is OpenHIM root, User cannot be deleted through the API", "info");
        return;
    }

    try {
        yield User.findOneAndRemove({ email }).exec();
        this.body = `Successfully removed user with email ${email}`;
        return logger.info(`User ${this.authenticated.email} removed user ${email}`);
    } catch (e) {
        return utils.logAndSetResponse(this, 500, `Could not remove user ${email} via the API ${e}`, "error");
    }
}


export function* getUsers() {
    // Test if the user is authorised
    if (!authorisation.inGroup("admin", this.authenticated)) {
        utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to getUsers denied.`, "info");
        return;
    }

    try {
        return this.body = yield User.find().exec();
    } catch (e) {
        return utils.logAndSetResponse(this, 500, `Could not fetch all users via the API ${e}`, "error");
    }
}
