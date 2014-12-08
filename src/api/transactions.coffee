transactions = require '../model/transactions'
Channel = require('../model/channels').Channel
Q = require 'q'
logger = require 'winston'
authorisation = require './authorisation'

getChannelIDsArray = (channels) ->
  channelIDs = []
  for channel in channels
    channelIDs.push channel._id.toString()
  return channelIDs


# function to construct projection object
getProjectionObject = (filterRepresentation) ->
  switch filterRepresentation
    when "simpledetails"
      # view minimum required data for transaction details view
      return { "request.body": 0, "response.body": 0, "routes.request.body": 0, "routes.response.body": 0, "orchestrations.request.body": 0, "orchestrations.response.body": 0 };
    when "full"
      # view all transaction data
      return {};
    else
      # no filterRepresentation supplied - simple view
      # view minimum required data for transactions
      return { "request.body": 0, "request.headers": 0, "response.body": 0, "response.headers": 0, orchestrations: 0, routes: 0 };
  



###
# Retrieves the list of transactions
###
exports.getTransactions = `function *getTransactions() {

  try {

    var filtersObject = this.request.query;

    //construct date range filter option
    if( filtersObject.startDate && filtersObject.endDate ){
      filtersObject['request.timestamp'] = { $gte: filtersObject.startDate, $lt: filtersObject.endDate }

      //remove startDate/endDate from objects filter (Not part of filtering and will break filter)
      delete filtersObject.startDate;
      delete filtersObject.endDate;
    }

    //get limit and page values
    var filterLimit = filtersObject.filterLimit;
    var filterPage = filtersObject.filterPage;
    var filterRepresentation = filtersObject.filterRepresentation;

    //remove limit/page/filterRepresentation values from filtersObject (Not apart of filtering and will break filter if present)
    delete filtersObject.filterLimit;
    delete filtersObject.filterPage;
    delete filtersObject.filterRepresentation;

    //determine skip amount
    var filterSkip = filterPage*filterLimit;

    // Test if the user is authorised
    if (authorisation.inGroup('admin', this.authenticated) === false) {
      // if not an admin, restrict by transactions that this user can view
      var channels = yield authorisation.getUserViewableChannels(this.authenticated);

      if (!filtersObject.channelID) {
        filtersObject.channelID = { $in: getChannelIDsArray(channels) };
      }

      // set 'filterRepresentation' to default if user isnt admin
      filterRepresentation = '';
    }

    // get projection object
    projectionFiltersObject = getProjectionObject( filterRepresentation );

    // execute the query
    this.body = yield transactions.Transaction.find(filtersObject, projectionFiltersObject).skip(filterSkip).limit(filterLimit).sort({ 'request.timestamp': -1 }).exec();

  }catch (e){
    this.message = e.message;
    this.status = 'internal server error';
  }
}`

###
# Adds an transaction
###
exports.addTransaction = `function *addTransaction() {

  // Test if the user is authorised
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to addTransaction denied.')
    this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to addTransaction denied.'
    this.status = 'forbidden';
    return;
  }

  // Get the values to use
  var transactionData = this.request.body;
  var tx = new transactions.Transaction(transactionData);

  try {
    // Try to add the new transaction (Call the function that emits a promise and Koa will wait for the function to complete)
    yield Q.ninvoke(tx, "save");
    this.status = 'created';
  } catch (e) {
    logger.error('Could not add a transaction via the API: ' + e);
    this.body = e.message;
    this.status = 'internal server error';
  }

}`


###
# Retrieves the details for a specific transaction
###
exports.getTransactionById = `function *getTransactionById(transactionId) {
  // Get the values to use
  var transactionId = unescape(transactionId);

  try {

    var filtersObject = this.request.query;
    var filterRepresentation = filtersObject.filterRepresentation;

    //remove filterRepresentation values from filtersObject (Not apart of filtering and will break filter if present)
    delete filtersObject.filterRepresentation;

    // set filterRepresentation to 'full' if not supplied
    if ( !filterRepresentation ){
      filterRepresentation = 'full';
    }

    /* --------------Check if user has permission to view full content----------------- */
    // if user NOT admin, determine their representation privileges.
    if (authorisation.inGroup('admin', this.authenticated) === false) {
      // retrieve transaction channelID
      var txChannelID = yield transactions.Transaction.findById(transactionId, { 'channelID':1, _id:0 }).exec();
      if (txChannelID === null || txChannelID.length === 0) {
        this.body = "We could not find transaction with ID:'" + transactionId + "'.";
        this.status = 'not found';
      } else {
        // assume user is not allowed to view all content - show only 'simpledetails'
        filterRepresentation = 'simpledetails';

        // get channel.txViewFullAcl information by channelID
        var channel = yield Channel.findById(txChannelID.channelID, { 'txViewFullAcl':1, _id:0 }).exec();

        // loop through user groups
        for ( i=0; i<this.authenticated.groups.length; i++ ){
          // if user role found in channel txViewFullAcl - user has access to view all content
          if (channel.txViewFullAcl.indexOf(this.authenticated.groups[i]) >= 0) {
            // update filterRepresentation object to be 'full' and allow all content
            filterRepresentation = 'full';
            break;
          }
        }
      }
    }
    /* --------------Check if user has permission to view full content----------------- */

    // get projection object
    projectionFiltersObject = getProjectionObject( filterRepresentation );

    var result = yield transactions.Transaction.findById(transactionId, projectionFiltersObject).exec();

    // Test if the result if valid
    if (result === null || result.length === 0) {
      this.body = "We could not find transaction with ID:'" + transactionId + "'.";
      this.status = 'not found';
    // Test if the user is authorised
    } else if (authorisation.inGroup('admin', this.authenticated) === false) {
      var channels = yield authorisation.getUserViewableChannels(this.authenticated);
      if (getChannelIDsArray(channels).indexOf(result.channelID.toString()) >= 0) {
        this.body = result
      } else {
        this.body = "The user " + this.authenticated.email + " is not authorised to access this transaction.";
        this.status = 'forbidden';
      }
    } else {
      this.body = result;
    }
  } catch (e) {
    // Error! So inform the user
    logger.error('Could not get transaction by ID via the API: ' + e);
    this.body = e.message;
    this.status = 'internal server error';
  }
}`

###
# Retrieves all transactions specified by clientId
###
exports.findTransactionByClientId = `function *findTransactionByClientId(clientId){
  var clientId = unescape(clientId)

  try {

    var filtersObject = this.request.query;
    var filterRepresentation = filtersObject.filterRepresentation;

    // get projection object
    projectionFiltersObject = getProjectionObject( filterRepresentation );

    filtersObject = {};
    filtersObject.clientID = clientId;

    // Test if the user is authorised
    if (authorisation.inGroup('admin', this.authenticated) === false) {
      // if not an admin, restrict by transactions that this user can view
      var channels = yield authorisation.getUserViewableChannels(this.authenticated);

      filtersObject.channelID = { $in: getChannelIDsArray(channels) };

      // set 'filterRepresentation' to default if user isnt admin
      filterRepresentation = '';
    }

    // execute the query
    this.body = yield transactions.Transaction.find(filtersObject, projectionFiltersObject).sort({ 'request.timestamp': -1 }).exec();
    
  } catch(e) {
    logger.error('Could not find a transaction by client by via the API: ' + e);
    this.body = e.message;
    this.status = 'internal server error';
  }
}`

###
# Updates a transaction record specified by transactionId
###
exports.updateTransaction = `function *updateTransaction(transactionId) {

  // Test if the user is authorised
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to updateTransaction denied.')
    this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to updateTransaction denied.'
    this.status = 'forbidden';
    return;
  }

  var transactionId = unescape(transactionId);
  var updates = this.request.body;

  try {
    yield transactions.Transaction.findByIdAndUpdate(transactionId, updates).exec();
    this.body = "Transaction with ID:"+transactionId+" successfully updated.";
    this.status = 'ok';
  } catch(e) {
    logger.error('Could not update a transaction via the API: ' + e);
    this.body = e.message;
    this.status = 'internal server error';
  }
}`


###
#Removes a transaction
###
exports.removeTransaction = `function *removeTransaction(transactionId) {

  // Test if the user is authorised
  if (authorisation.inGroup('admin', this.authenticated) === false) {
    logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to removeTransaction denied.')
    this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to removeTransaction denied.'
    this.status = 'forbidden';
    return;
  }

  // Get the values to use
  var transactionId = unescape(transactionId);

  try {
    yield transactions.Transaction.findByIdAndRemove(transactionId).exec();
    this.body = 'Transaction successfully deleted';
    this.status = 'ok';
  }
  catch (e) {
    logger.error('Could not remove a transaction via the API: ' + e);
    this.body = e.message;
    this.status = 'internal server error';
  }
}`
