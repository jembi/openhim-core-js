mongo = require "mongodb"
mongoose = require "mongoose"
Schema = mongoose.Schema
config = require "./config"
logger = require "winston"

mongoose.connect config.mongo.url

# Request Schema definition
RequestDef = 
	"path" :{ type: String, required: true }
	"headers": {type: Object}
	"querystring": { type: String }
	"body":{ type: String}
	"method":{ type: String, required: true }
	"timestamp":{ type: Date, required: true }

# Response Schema definition
ResponseDef =
	"status" :{ type: Number }
	"headers": { type: Object }
	"body":{ type: String }
	"timestamp":{ type: Date }

# Route Schema
RouteSchema = new Schema
    "name" :{ type: String, required: true }
    "request": RequestDef
    "response": ResponseDef

# Orchestrations Schema
OrchestrationSchema = new Schema
    "name" :{ type: String, required: true }
    "request": RequestDef
    "response": ResponseDef

# Validator Method for Status value - NOT USED
statusValidator = (status)->
        return status in ["Processing","Failed","Completed"]

# Trasnaction schema 
TransactionSchema = new Schema    
    "applicationID": { type: String, required: true } 
    "request": RequestDef
    "response": ResponseDef
    "routes": [ RouteSchema ]    
    "orchestrations": [ OrchestrationSchema ]    
    "properties": { type: Object }
    "status": { type: String, required:true, enum: ["Processing","Failed","Completed"]} 

#compile schema into Model    
exports.Route = mongoose.model 'Route', RouteSchema
exports.Orchestration = mongoose.model 'Orchestration', OrchestrationSchema
Transaction = mongoose.model 'Transaction', TransactionSchema
exports.Transaction = Transaction

#save transaction to db
exports.addTransaction = (tx, done) ->
    newTransaction = new Transaction tx
    newTransaction.save (err, transaction) -> 
        if err
            return done err
        else
            return done null, transaction

# find all Transactions
exports.getTransactions = (done) ->
    Transaction.find (err, transactions) ->     
        if err
            return done err
        else
            return done null, transactions 

#find an Transaction by id
exports.findTransactionById = (id, done) ->
    Transaction.findOne {"_id":id},(err, transaction) -> 
        if err
            return done err
        else
            return done null, transaction   

# look up the transaction by applicationID
exports.findTransactionByApplicationId = (appId, done) ->
    Transaction.find {"applicationID":appId},(err, transactions) -> 
        if err
            return done err
        else
            return done null, transactions   

#update the specified transaction
exports.updateTransaction = (id, updates, done) ->   
    Transaction.findOneAndUpdate {"_id": id}, updates, (err) ->     
        if err
            return done err
        else
            return done null   

#remove the specified transaction 
exports.removeTransaction = (id, done) ->   
    Transaction.remove {"_id":id},(err) ->     
        if err
            return done err
        else
            return done null

#count the number of transactions in db
exports.numTrans = (done) ->
    Transaction.count {}, (err, count) ->
        if err
            return done err
        else
            return done null, count
