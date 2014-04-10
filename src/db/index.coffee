mongoose = require('mongoose')
config = require('../config')
connectionString = config.get('mongo:url')
potions = {}
