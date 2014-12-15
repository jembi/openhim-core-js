User = require('../model/users').User
Q = require 'q'
logger = require 'winston'
authorisation = require './authorisation'

moment = require 'moment'
randtoken = require 'rand-token';
contact = require '../contact'
config = require "../config/config"
config.newUserExpiry = config.get('newUserExpiry')

###
# Get authentication details
###
exports.authenticate = `function *authenticate(email) {
  email = unescape(email)

  try {
    var user = yield User.findOne({ email: email }).exec();

    this.body = {
      salt: user.passwordSalt,
      ts: new Date()
    }
  } catch(e) {
    logger.error('Could not find user by email ' + email + ': ' + e);
    this.status = 'not found';
    this.body = 'Could not find user by email ' + email;
  }
}`


#######################################
### New User Set Password Functions ###
#######################################

# get the new user details
exports.getNewUser = `function *getNewUser(token) {
  token = unescape(token)

  try {

    projectionRestriction = { "firstname": 1, "surname": 1, "msisdn": 1, "token": 1, "locked": 1, "expiry": 1, "_id": 0 };

    var result = yield User.findOne({ token: token }, projectionRestriction).exec();
    if (result === null) {
      this.body = "User with token '"+token+"' could not be found.";
      this.status = 'not found';
    } else {
      // if expiry date has past
      if ( moment(result.expiry).utc().format() < moment().utc().format() ){
        // new user- set password - expired
        this.body = "User with token '"+token+"' has expired to set their password.";
        this.status = 'gone';
      }else{
        // valid new user - set password
        this.body = result;
      }

    }
  } catch(e) {
    logger.error('Could not find user with token '+token+' via the API: ' + e);
    this.body = e.message;
    this.status = 'internal server error';
  }
}`

# update the password/details for the new user
exports.updateNewUser = `function *updateNewUser(token) {
  token = unescape(token)
  var userData = this.request.body;
  
  try {
    // first try get new user details to check expiry date
    var newUserOldData = yield User.findOne({ token: token }).exec();

    if (newUserOldData === null) {
      this.body = "User with token '"+token+"' could not be found.";
      this.status = 'not found';
      return;
    } else {
      // if expiry date has past
      if ( moment(newUserOldData.expiry).utc().format() < moment().utc().format() ){
        // new user- set password - expired
        this.body = "User with token '"+token+"' has expired to set their password.";
        this.status = 'gone';
        return;
      }
    }
  } catch(e) {
    logger.error('Could not find user with token '+token+' via the API: ' + e);
    this.body = e.message;
    this.status = 'internal server error';
    return;
  }


  // check to make sure 'msisdn' isnt 'undefined' when saving
  var msisdn = null;
  if ( userData.msisdn ){
    msisdn = userData.msisdn;
  }

  // construct user object to prevent other properties from being updated
  newUserUpdate = { 
    firstname: userData.firstname,
    surname: userData.surname,
    token: null,
    locked: false,
    expiry: null,
    msisdn: msisdn,
    passwordAlgorithm: userData.passwordAlgorithm,
    passwordSalt: userData.passwordSalt,
    passwordHash: userData.passwordHash 
  }

  try {
    yield User.findOneAndUpdate({ token: token }, newUserUpdate).exec();
    this.body = "Successfully set new user password."
  } catch(e) {
    logger.error('Could not update user by token '+token+' via the API: ' + e);
    this.body = e.message;
    this.status = 'internal server error';
  }
}`

#######################################
### New User Set Password Functions ###
#######################################


###
# Adds a user
###
exports.addUser = `function *addUser() {

  // Test if the user is authorised
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to addUser denied.')
    this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to addUser denied.'
    this.status = 'forbidden';
    return;
  }

  var userData = this.request.body

  /*
  # Generate the new user token here
  # set locked = true
  # set expiry date = true
  */

  var token = randtoken.generate(32);
  userData.token = token;
  userData.locked = true;

  duration = config.newUserExpiry.duration;
  var durationType = config.newUserExpiry.durationType;
  userData.expiry = moment().add(duration, durationType).utc().format();

  var consoleURL = config.alerts.consoleURL;
  var setPasswordLink = consoleURL + '/#/set-password/'+token;

  try {
    var user = new User(userData);
    var result = yield Q.ninvoke(user, 'save');

    /* 
    # Send email to new user to set password
    */

    var plainMessage;
    plainMessage = '<---------- New User - Set Password ----------> \r\n \r\n';
    plainMessage += 'Hi '+userData.firstname+', A profile has been created for you on OpenHIM \r\n';
    plainMessage += 'Follow the below link to set your password and log into OpenHIM Console  \r\n';
    plainMessage += setPasswordLink + '\r\n';
    plainMessage += '<---------- New User - Set Password ----------> \r\n \r\n';
    plainMessage += '\r\n';

    var htmlMessage;
    htmlMessage = '<h1>Hi '+userData.firstname+', A profile has been created for you on OpenHIM</h1>';
    htmlMessage += '<p>Follow the below link to set your password and log into OpenHIM Console</p>';
    htmlMessage += '<p>'+setPasswordLink+'</p>';

    contact.contactUser('email', userData.email, 'OpenHIM Console Profile', plainMessage, htmlMessage, function(){
      logger.info('The email has been sent to the new user');
    })
    
    this.body = 'User successfully created';
    this.status = 'created';
  } catch(e) {
    logger.error('Could not add a user via the API: ' + e);
    this.body = e.message;
    this.status = 'bad request';
  }
}`

###
# Retrieves the details of a specific user
###
exports.getUser = `function *findUserByUsername(email) {

  var email = unescape(email);

  // Test if the user is authorised, allow a user to fetch their own details
  if (authorisation.inGroup('admin', this.authenticated) === false && this.authenticated.email !== email) {
    logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to findUserByUsername denied.')
    this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to findUserByUsername denied.'
    this.status = 'forbidden';
    return;
  }

  try {
    var result = yield User.findOne({ email: email }).exec();
    if (result === null) {
      this.body = "User with email '"+email+"' could not be found.";
      this.status = 'not found';
    } else {
      this.body = result;
    }
  } catch(e) {
    logger.error('Could not find user with email '+email+' via the API: ' + e);
    this.body = e.message;
    this.status = 'internal server error';
  }
}`

exports.updateUser = `function *updateUser(email) {

  var email = unescape(email);

  // Test if the user is authorised, allow a user to update their own details
  if (authorisation.inGroup('admin', this.authenticated) === false && this.authenticated.email !== email) {
    logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to updateUser denied.')
    this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to updateUser denied.'
    this.status = 'forbidden';
    return;
  }

  var userData = this.request.body;

  // reset token/locked/expiry when user is updated and password supplied
  if ( userData.passwordAlgorithm && userData.passwordHash && userData.passwordSalt ){
    userData.token = null;
    userData.locked = false;
    userData.expiry = null;
  }

  // Don't allow a non-admin user to change their groups
  if (this.authenticated.email === email && authorisation.inGroup('admin', this.authenticated) === false) {
    delete userData.groups
  }

  //Ignore _id if it exists (update is by email)
  if (userData._id) {
    delete userData._id;
  }

  try {
    yield User.findOneAndUpdate({ email: email }, userData).exec();
    this.body = "Successfully updated user."
  } catch(e) {
    logger.error('Could not update user by email '+email+' via the API: ' + e);
    this.body = e.message;
    this.status = 'internal server error';
  }
}`

exports.removeUser = `function *removeUser(email) {

  // Test if the user is authorised
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to removeUser denied.')
    this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to removeUser denied.'
    this.status = 'forbidden';
    return;
  }

  var email = unescape (email);

  // Test if the user is root@openhim.org
  if ( email === 'root@openhim.org' ) {
    logger.info('User ' +this.authenticated.email+ ' is OpenHIM root, User cannot be deleted through the API')
    this.body = 'User ' +this.authenticated.email+ ' is OpenHIM root, User cannot be deleted through the API'
    this.status = 'forbidden';
    return;
  }

  try {
    yield User.findOneAndRemove({ email: email }).exec();
    this.body = "Successfully removed user with email '"+email+"'";
  }catch(e){
    logger.error('Could not remove user by email '+email+' via the API: ' + e);
    this.body = e.message;
    this.status = 'internal server error';
  }

}`

exports.getUsers = `function *getUsers() {

  // Test if the user is authorised
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to getUsers denied.')
    this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to getUsers denied.'
    this.status = 'forbidden';
    return;
  }

  try {
    this.body = yield User.find().exec();
  }catch (e){
    logger.error('Could not fetch all users via the API: ' + e);
    this.message = e.message;
    this.status = 'internal server error';
  }
}`
