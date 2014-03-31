application = require '../applications'
Q = require 'q'


###
Adds an application 
###

exports.addApplication = `function *addApplication(){
	var application = this.request.body

	var addApplication = Q.denodeify(application.addApplication);

	try  {
			var result = yield addApplication(application);
			if (result == null){
				this.body = "Application successfully added";
				this.status = 201;
			}
		}catch(e){
			// Error! So inform the user
			this.body = e.message;
			this.status = 400;

		}
}`

###
# Retrieves the details of a specific application
###
exports.getApplication = `function *findApplicationById(applicationId) {
	var applicationId = unescape(applicationId);
	var findApplicationById = Q.denodeify(application.findApplicationById);

	try{
			var result = yield findApplicationById(applicationId);
			if(result === null){
				this.body = "Application with id '"+applicationId+"' could not be found.";
				this.status = 404;
			}else{
				this.body = result;
			}
	}catch(e){
			this.body = e.message;
			this.status = 500;

	}
}`


exports.findApplicationByDomain = `function *findApplicationByDomain(domain){

	var applicationId = unescape(domain);

	var findApplicationByDomain = Q.denodeify(router.findApplicationByDomain);

	try{
		var result = yield findApplicationByDomain(domain);
		if(result === null){
			this.body = "Could not find application with domain '"+domain+"'";
			this.status = 404;
		}else{
			this.body = result;
		}
	}catch(e){
		this.body = e.message;
		this.status = 500;
	}
}`

exports.updateApplication = `function *updateApplication(applicationId) {
	var applicationId = unescape(applicationId);
	var application = this.request.body;

	var updateApplication = Q.denodeify(router.updateApplication);

	try{
		yield updateApplication(application);
		this.body = "Successfully updated application."
	}catch(e){
			this.body = e.message;
			this.status = 500;		
	}
}`

exports.removeApplication = `function *removeApplication(applicationId){
	var applicationId = unescape (applicationId);

	var removeApplication = Q.denodeify(router.removeApplication);

	try{
		yield removeApplication(applicationId);
		this.body = "Successfully removed application with ID '"+applicationId+"'";
	}catch(e){
			this.body = e.message;
			this.status = 500;		
	}

}`

exports.getApplications = `function *getApplications(){

	var getApplications = Q.denodeify(router.getApplications);

	try{
			this.body = yield getApplications;
		}catch (e){
			this.message = e.message;
			this.status = 500;
		}

}`