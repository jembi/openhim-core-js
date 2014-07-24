http = require "http"

# Create mock endpoint to forward requests to
mockServer = http.createServer (req, res) ->
	res.writeHead 201, {"Content-Type": "text/plain"}
	res.write "Mock response body\n"
	res.end()
	console.log "Responded!"

mockServer.listen 9876, ->
	console.log "Mock server listening on 9876"