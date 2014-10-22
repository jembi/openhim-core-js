logger = require 'winston'
authorisation = require './api/authorisation'
server = require "./server"
config = require "./config/config"
config.router = config.get('router')
config.api = config.get('api')
config.rerun = config.get('rerun')
config.polling = config.get('polling')
config.tcpAdapter = config.get('tcpAdapter')

###
# restart the server
###
exports.restart = `function *restart() {

	// Test if the user is authorised
	if (authorisation.inGroup('admin', this.authenticated) === false) {
		logger.info('User ' +this.authenticated.email+ ' is not an admin, API access to Restart the server denied.')
		this.body = 'User ' +this.authenticated.email+ ' is not an admin, API access to Restart the server denied.'
		this.status = 'forbidden';
		return;
	}

	try {

		// All ok! So set the result
		this.body = 'Server being restarted';

		// stop the server
		server.stop(function(){

			var apiPort, httpPort, httpsPort, pollingPort, rerunPort, tcpHttpReceiverPort;
			httpPort = config.router.httpPort;
			httpsPort = config.router.httpsPort;
			apiPort = config.api.httpsPort;
			rerunPort = config.rerun.httpPort;
			tcpHttpReceiverPort = config.tcpAdapter.httpReceiver.httpPort;
			pollingPort = config.polling.pollingPort;
			
			// start the server again
			server.start(httpPort, httpsPort, apiPort, rerunPort, tcpHttpReceiverPort, pollingPort);

		});

	}
	catch (e) {
		// Error! So inform the user
		logger.error('Could not restart the servers via the API: ' + e);
		this.body = e.message;
		this.status = 'bad request';
	}
}`