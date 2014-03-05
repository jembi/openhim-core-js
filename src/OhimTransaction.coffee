#This script is used to save the Trasnaction Object/Message into Mongo

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

	#orchestrations Schema
RequestSchema = new Schema
	"name" :{type: String, required: true}
	"request": RequestSchema
	"response": ResponseSchema

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
	"timestamp":{type: Date, required: true}

	#Application Schema
ApplicationSchema = new Schema
    "applicationID": {type: String, required: true}
    "domain": {type: String, required: true}
    "name": {type: String, required: true}
    "routes": [ {name, request, response}]
    "orchestrations": [{name, request,response}]
    "properties": [ {property}]