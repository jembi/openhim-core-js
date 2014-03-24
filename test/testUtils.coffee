http = require "http"

exports.createMockServer = (resStatusCode, resBody, port, callback, requestCallback) ->
	requestCallback = requestCallback || ->
	# Create mock endpoint to forward requests to
	mockServer = http.createServer (req, res) ->
		res.writeHead resStatusCode, {"Content-Type": "text/plain"}
		res.end resBody

	mockServer.listen port, callback
	mockServer.on "request", requestCallback 