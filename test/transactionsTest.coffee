should = require "should"
sinon = require "sinon"
transaction = require "../lib/transactions"

describe "Transactions", ->

	describe ".storeTransaction(transactionJson)", ->
		it "should return the newly added Transaction Document as contained in the JSON document", (done) ->
			testTxDoc =
    			"status": "Processing|Failed|Completed"
    			"applicationId": "Musha_OpenMRS"
    			"request": {
        			"path": "/api/test"
        			"headers": [
            						{ "header1": "value1" }
            						{ "header2": "value2" }
       							]
        			"requestParams": [
            						{ "param1": "value1" }
            						{ "param2": "value2" }
        						]
        			"body": "<HTTP body>"
        			"method": "POST"
    			}
    			"response": {
        			"status": 201
        			"body": "<HTTP body>"
        			"headers": [
            						{ "header1": "value1" }
            						{ "header2": "value2" }
        			]
    			}
    			"routes": [
        					{
            					"name": "dummy-route"
            					"request": { }
            					"response": { }
        					}
    					]
    			"orchestrations": [
        							{
            							"name": "dummy-orchestration"            
            							"request": { }
            							"response": { }
        							}
    							]
    			"properties": [ 
        						{ "prop1": "value1" }
        						{ "prop2": "value2" }
    						]
				

			transaction.addTransaction testTxDoc, (error, doc)->
					(doc != null).should.be.true
					doc.should.have.property("applicationId", "testtx")
					done()