Application = require('../model/applications').Application
Q = require 'q'
logger = require 'winston'

###
# Adds an application 
###
exports.addApplication = `function *addApplication(){
	var applicationData = this.request.body

	try {
		var app = new Application(applicationData);
		var result = yield Q.ninvoke(app, 'save');
		
		this.body = result;
		this.status = 201;
	} catch(e) {
		logger.error('Could not add a application via the API: ' + e);
		this.body = e.message;
		this.status = 400;
	}
}`

###
# Retrieves the details of a specific application
###
exports.getApplication = `function *findApplicationById(applicationId) {
	var applicationId = unescape(applicationId);

	try {
		var result = yield Application.findOne({ applicationID: applicationId }).exec();
		if (result === null) {
			this.body = "Application with id '"+applicationId+"' could not be found.";
			this.status = 404;
		} else {
			this.body = result;
		}
	} catch(e) {
		logger.error('Could not find application by id '+applicationId+' via the API: ' + e);
		this.body = e.message;
		this.status = 500;

	}
}`


exports.findApplicationByDomain = `function *findApplicationByDomain(domain){

	var domain = unescape(domain);

	try {
		var result = yield Application.findOne({ domain: domain }).exec();
		if (result === null) {
			this.body = "Could not find application with domain '"+domain+"'";
			this.status = 404;
		}else{
			this.body = result;
		}
	} catch(e) {
		logger.error('Could not find application by domain '+domain+' via the API: ' + e);
		this.body = e.message;
		this.status = 500;
	}
}`

exports.updateApplication = `function *updateApplication(applicationId) {
	var applicationId = unescape(applicationId);
	var applicationData = this.request.body;

	try {
		yield Application.findOneAndUpdate({ applicationID: applicationId }, applicationData).exec();
		this.body = "Successfully updated application."
	} catch(e) {
		logger.error('Could not update application by ID '+applicationId+' via the API: ' + e);
		this.body = e.message;
		this.status = 500;		
	}
}`

exports.removeApplication = `function *removeApplication(applicationId){
	var applicationId = unescape (applicationId);

	try {
		yield Application.findOneAndRemove({ applicationID: applicationId }).exec();
		this.body = "Successfully removed application with ID '"+applicationId+"'";
	}catch(e){
		logger.error('Could not remove application by ID '+applicationId+' via the API: ' + e);
		this.body = e.message;
		this.status = 500;		
	}

}`

exports.getApplications = `function *getApplications(){
	try {
		this.body = yield Application.find().exec();
	}catch (e){
		logger.error('Could not fetch all applications via the API: ' + e);
		this.message = e.message;
		this.status = 500;
	}
}`