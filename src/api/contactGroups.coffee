ContactGroup = require('../model/contactGroups').ContactGroup
Q = require 'q'
logger = require 'winston'
authorisation = require './authorisation'


###############################
#     Adds a contactGroup     #
###############################
exports.addContactGroup = `function *addContactGroup() {

  // Test if the user is authorised
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to addContactGroup denied.')
    this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to addContactGroup denied.'
    this.status = 'forbidden';
    return;
  }

  var contactGroupData = this.request.body

  try {
    var contactGroup = new ContactGroup(contactGroupData);
    var result = yield Q.ninvoke(contactGroup, 'save');
    
    this.body = 'Contact Group successfully created';
    this.status = 'created';
  } catch(e) {
    logger.error('Could not add a contact group via the API: ' + e);
    this.body = e.message;
    this.status = 'bad request';
  }
}`


#############################################################
#     Retrieves the details of a specific contact group     #
#############################################################
exports.getContactGroup = `function *findContactGroupById(contactGroupId) {

  // Test if the user is authorised
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to findContactGroupById denied.')
    this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to findContactGroupById denied.'
    this.status = 'forbidden';
    return;
  }

  var contactGroupId = unescape(contactGroupId);

  try {
    var result = yield ContactGroup.findById(contactGroupId).exec();
    if (result === null) {
      this.body = "Contact Group with id '"+contactGroupId+"' could not be found.";
      this.status = 'not found';
    } else {
      this.body = result;
    }
  } catch(e) {
    logger.error('Could not find Contact Group by id '+contactGroupId+' via the API: ' + e);
    this.body = e.message;
    this.status = 'internal server error';

  }
}`


##################################
#     Updates a contactGroup     #
##################################
exports.updateContactGroup = `function *updateContactGroup(contactGroupId) {

  // Test if the user is authorised
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to updateContactGroup denied.')
    this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to updateContactGroup denied.'
    this.status = 'forbidden';
    return;
  }

  var contactGroupId = unescape(contactGroupId);
  var contactGroupData = this.request.body;

  // Ignore _id if it exists, a user shouldn't be able to update the internal id
  if (contactGroupData._id) {
    delete contactGroupData._id;
  }

  try {
    yield ContactGroup.findByIdAndUpdate(contactGroupId, contactGroupData).exec();
    this.body = "Successfully updated contact group."
  } catch(e) {
    logger.error('Could not update contact group by ID '+contactGroupId+' via the API: ' + e);
    this.body = e.message;
    this.status = 'internal server error';
  }
}`


##################################
#     Removes a contactGroup     #
##################################
exports.removeContactGroup = `function *removeContactGroup(contactGroupId) {

  // Test if the user is authorised
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to removeContactGroup denied.')
    this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to removeContactGroup denied.'
    this.status = 'forbidden';
    return;
  }

  var contactGroupId = unescape (contactGroupId);

  try {
    yield ContactGroup.findByIdAndRemove(contactGroupId).exec();
    this.body = "Successfully removed contact group with ID '"+contactGroupId+"'";
  }catch(e){
    logger.error('Could not remove contact group by ID '+contactGroupId+' via the API: ' + e);
    this.body = e.message;
    this.status = 'internal server error';
  }

}`


#######################################
#     Retrieves all contactGroups     #
#######################################
exports.getContactGroups = `function *getContactGroups() {

  // Test if the user is authorised
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to getContactGroups denied.')
    this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to getContactGroups denied.'
    this.status = 'forbidden';
    return;
  }

  try {
    this.body = yield ContactGroup.find().exec();
  }catch (e){
    logger.error('Could not fetch all contact groups via the API: ' + e);
    this.message = e.message;
    this.status = 'internal server error';
  }
}`
