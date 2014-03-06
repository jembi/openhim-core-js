mongo = require "mongodb"
mongoose = require "mongoose"
Schema = mongoose.Schema

#This script is used to save the Trasnaction Object/Message into Mongo

mongo = require "mongodb"
mongoose = require "mongoose"
Schema = mongoose.Schema

MONGO_DB_URL= 'mongodb://localhost:27017/test2'

mongoDBConn = mongoose.createConnection MONGO_DB_URL 

#schema definition - 
###
{
    "_id": "123",
    "status": "Processing|Failed|Completed",
    "applicationId": "Musha_OpenMRS",
    "request": {
        "path": "/api/test",
        "headers": [
            { "header1": "value1" },
            { "header2": "value2" }
        ],
        "requestParams": [
            { "param1": "value1" },
            { "param2": "value2" }
        ],
        "body": "<HTTP body>",
        "method": "POST",
        "timestamp": "<ISO 8601>"
    },
    "response": {
        "status": 201,
        "body": "<HTTP body>",
        "headers": [
            { "header1": "value1" },
            { "header2": "value2" }
        ],
        "timestamp": "<ISO 8601>"
    },
    "routes": [
        {
            "name": "<route name>"
            // Same structure as above
            "request": { ... },
            "response": { ... }
        }
    ]
    "orchestrations": [
        {
            "name": "<orchestration name>"
            // Same structure as above
            "request": { ... },
            "response": { ... }
        }
    ]
    "properties": [ // optional meta data about a transaction
        { "prop1": "value1" },
        { "prop2": "value2" }
    ]
}
###
    
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

    #compile schema into Model    
Transaction = mongoDBConn.model 'Transaction', TransactionSchema


exports.addTransaction = (tx, done) ->
    newTransaction  = new Transaction tx
    newTransaction.save (err, saveResult) ->     
            if err
                console.log "Unable to save record: #{err}"
                return done err
            else
                console.log "Application Collection Saved #{saveResult}"  
                return done null, saveResult 


#find an Transaction by id

exports.findTransactionById = (id, done) ->
    Transaction.findOne {"_id":id},(err, application) ->     
            if err
                console.log "Unable to find application: #{err}"
                return done err
            else
                console.log "Found Application #{application}"  
                return done null, application   

# look up the transaction by applicationId
exports.findTransactionByApplicationId = (appId, done) ->
    Transaction.findOne {"applicationID":appId},(err, application) ->     
            if err
                console.log "Unable to find application: #{err}"
                return done err
            else
                console.log "Found Application #{application}"  
                return done null, application   

#update the specified application
exports.updateTransaction = (id, updates, done) ->   
    Transaction.findOneAndUpdate {"applicationID":id},updates,(err) ->     
            if err
                console.log "Unable to Update Transaction: #{err}"
                return done err
            else
                console.log "Updated Transaction #{result}"  
                return done null, result   

#remove the specified application 
exports.removeApplication = (id, done) ->   
    Application.remove {"applicationID":id},(err) ->     
            if err
                console.log "Unable to Remove Application: #{err}"
                return done err
            else
                console.log "Removed Application #{result}"  
                return done null, result   