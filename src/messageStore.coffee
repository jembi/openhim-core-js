MongoClient = require('mongodb').MongoClient;

exports.store = `function *store(next) {
		console.log("Store request");
		yield next;
		console.log("Store response");
	}`

