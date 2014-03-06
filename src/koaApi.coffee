koa = require 'koa'
route = require 'koa-route'
router = require './router'
Q = require 'q'

exports.setupApp = (done) ->
	
	# Create an instance of the koa-server
	app = koa()

	# Define the api routes
	app.use route.get '/channels', channels_list

	# Return the result
	done(app)

`function *channels_list() {

	var getChannels = Q.denodeify(router.getChannels);
	this.body = yield getChannels();

};`
