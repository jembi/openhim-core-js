mongo = require "mongodb"
mongoose = require "mongoose"
Schema = mongoose.Schema
config = require "./config"

mongoose.connect config.mongo.url
    
#Request Schema
RequestSchema = new Schema
	"path" :{type: String, required: true}
	"headers": [{header:{type:String, required: true}, value:{type:String, required: true}}]
	"requestParams":[{parameter:{type:String, required: true}, value:{type:String, required: true}}]
	"body":{type: String, required: true}
	"method":{type: String, required: true}
	"timestamp":{type: Date, required: true}

#Response Schema
ResponseSchema = new Schema
	"status" :{type: Number, required: true}
	"headers": [{header:{type:String, required: true}, value:{type:String, required: true}}]
	"body":{type: String, required: true}
	"timestamp":{type: Date, required: true, default: Date.now}

RouteSchema = new Schema
    "name" :{type: String, required: true}
    "request": [RequestSchema]
    "response": [ResponseSchema]

#orchestrations Schema
OrchestrationSchema = new Schema
    "name" :{type: String, required: true}
    "request": [RequestSchema]
    "response": [ResponseSchema]

#Validator Method for Status value - NOT USED
statusValidator = (status)->
        return status in ["Processing","Failed","Completed"]

# Trasnaction schema 
TransactionSchema = new Schema    
    "applicationID": {type: String, required: true} 
    "request": [RequestSchema]
    "response": [ResponseSchema]
    "routes": [RouteSchema]    
    "orchestrations": [OrchestrationSchema]    
    "properties": [{property:{type:String, required: true}, value:{type:String, required: true}}]
    "status": {type: String, required:true,enum: ["Processing","Failed","Completed"]} 

#compile schema into Model    
Transaction = mongoose.model 'Transactions', TransactionSchema

#save transaction to db
exports.addTransaction = (tx, done) ->
    newTransaction  = new Transaction tx
    newTransaction.save (err, saveResult) ->  
        if err
            return done err
        else
            return done null,saveResult    

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
    Transaction.findOneAndUpdate {"_id":id},updates,(err) -> 
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
exports.Request = (path, headers, requestParams, body, method, done) ->
    newRequest = new Object()
    newRequest.path = path
    newRequest.headers = headers   
    newRequest.requestParams = requestParams
    newRequest.body = body
    newRequest.method = method
    newRequest.timestamp = new Date()
    done null, newRequest

exports.Transaction = (status,applicationID,request,response,routes,orchestrations,properties, done) ->
    newTransaction = new Object()
    newTransaction.status = status
    newTransaction.applicationID = applicationID
    newTransaction.request = [request]
    newTransaction.response = response
    newTransaction.routes = routes
    newTransaction.orchestrations = orchestrations
    newTransaction.properties = properties
    done null, newTransaction

