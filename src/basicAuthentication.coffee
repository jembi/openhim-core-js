auth = require 'basic-auth'

getTrustedApplicationCredentials = ->
	# FIXME: this should read from all saved applications, the following is done for test purposes
	# once #15 is complete we should be able to update this
	return [{name:"user", pass:"password"}, {name:"user2", pass:"password2"}]

###
# Koa middleware for
###
exports.koaMiddleware = `function *basicAuthMiddleware(next) {
	var user = auth(this);
	var credentialsList = getTrustedApplicationCredentials()

	//var authenticated = false;

	for (i = 0; i < credentialsList.length; ++i) {
		var credentials = credentialsList[i];
		console.log(user);

		if(user && credentials.name === user.name) {
			if(credentials.pass === user.pass) {
				// lookup application by subject.cn (cn = domain) and set them as the authenticated user
				// FIXME: Add test data in the mean time
				// once #15 is complete we should be able to update this
				this.authenticated = {
					"applicationID": credentials.name,
					"domain": "him.jembi.org",
					"name": "OpenMRS Musha instance",
					"roles": [ "OpenMRS_PoC", "PoC" ],
				};

				//Matches a username and password
				break;//Don't resume this credential check loop when function resumes
			} else {
				//Username exists but doen't match password
				this.throw(401);
			}
		}
	}
	
	if (this.authenticated) {
		yield next;
	} else {
		//User not found in credential list
		this.throw(401);
	}
}`
