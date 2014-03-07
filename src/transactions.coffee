mongo = require "mongodb"
mongoose = require "mongoose"
Schema = mongoose.Schema

#This script is used to save the Trasnaction Object/Message into Mongo

mongo = require "mongodb"
mongoose = require "mongoose"
Schema = mongoose.Schema

MONGO_DB_URL= 'mongodb://localhost:27017/test'

mongoDBConn = mongoose.createConnection MONGO_DB_URL 

#schema definition - 
    
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
    "applicationId": {type: String, required: true} 
    "request": [RequestSchema]
    "response": [ResponseSchema]
    "routes": [RouteSchema]    
    "orchestrations": [OrchestrationSchema]    
    "properties": [{property:{type:String, required: true}, value:{type:String, required: true}}]
    "status": {type: String, required:true,enum: ["Processing","Failed","Completed"]} 

    #CRUD Transaction

    #compile schema into Model    
Transaction = mongoDBConn.model 'Transactions', TransactionSchema


exports.addTransaction = (tx, done) ->
    newTransaction  = new Transaction tx
    newTransaction.save (err, saveResult) ->     
        if err
            console.log "Unable to save record: #{err}"
            return done err
        else
            console.log "Transaction Collection Saved #{saveResult}"  
            return done null,saveResult    

# find all TransactionSchema

exports.findAll = (id, done) ->
    Transaction.find (err, transactions) ->     
            if err
                console.log "Unable to find transactions: #{err}"
                return done err
            else
                console.log "Found Transactions #{transactions}"  
                return done null, transactions 

#find an Transaction by id

exports.findTransactionById = (id, done) ->
    Transaction.findOne {"_id":id},(err, transaction) ->     
            if err
                console.log "Unable to find transaction: #{err}"
                return done err
            else
                console.log "Found Transaction #{transaction}"  
                return done null, transaction   

# look up the transaction by applicationId
exports.findTransactionByApplicationId = (appId, done) ->
    Transaction.find {"applicationId":appId},(err, transactions) ->     
            if err
                console.log "Unable to find Transaction: #{err}"
                return done err
            else
                console.log "Found Transactions #{transactions}"  
                return done null, transactions   

#update the specified application
exports.updateTransaction = (id, updates, done) ->   
    Transaction.findOneAndUpdate {"_id":id},updates,(err) ->     
            if err
                console.log "Unable to Update Transaction: #{err}"
                return done err
            else
                console.log "Updated Transaction #{result}"  
                return done null   

#remove the specified application 
exports.removeTransaction = (id, done) ->   
    Transaction.remove {"_id":id},(err) ->     
            if err
                console.log "Unable to Remove Transaction: #{err}"
                return done err
            else
                console.log "Removed Transaction #{result}"  
                return done null  


    #CRUD Orchestrations 

    #CRUD Request


    #CRUD Response
