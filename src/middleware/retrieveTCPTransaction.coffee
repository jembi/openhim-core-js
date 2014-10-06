tcpAdapter = require '../tcpAdapter'

exports.koaMiddleware = `function *(next) {
	//the body contains the key
	var transaction = tcpAdapter.popTransaction(this.body);

	this.body = transaction.data;
	this.authorisedChannel = transaction.channel;

	yield next;
}`
