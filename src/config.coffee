config = {}
config.router = {}
config.api = {}
config.mongo = {}
config.authentication = {}

# Router config
config.router.httpPort = 5001
config.router.httpsPort = 5000

# API config
config.api.httpPort = 8080

# Mongo config
config.mongo.url = 'mongodb://localhost:27017/openhim'

# Authentication config
config.authentication.enableMutualTLSAuthentication = true
config.authentication.enableBasicAuthentication = true

module.exports = config