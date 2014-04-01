should = require "should"
sinon = require "sinon"
mongoose = require "mongoose"
transaction = require "../lib/transactions"
config = require "../lib/config"

db = null
transactionId = null
applicationID = "Musha_OpenMRS_testNewDoc"
transactionIdToRemove = null

describe "Transactions", ->

	before (done)->
		db = mongoose.createConnection config.mongo.url
		collection = db.collection "transactions"
		collection.remove {}, (err, numRemoved) ->	
			done()
	after (done)->
		collection = db.collection "transactions"
		collection.remove {}, (err, numRecords)->
			done()				

	describe ".addTransaction(transactionJson)", ->

		it "should add new transaction to db", (done) ->            
			testTxDoc=
				status: "Processing"
				applicationID: "Musha_OpenMRS"
				request: 
					path: "/api/test"
					headers:   [
									header1: "value1" 
									header2: "value2" 
							]
					requestParams:  [
									param1: "value1" 
									param2: "value2" 
								]
					body: "<HTTP body>"
					method: "POST"
				
				response: 
					status: 201
					body: "<HTTP body>"
					headers: [
									header1: "value1" 
									header2: "value2" 
					]
				
				routes: 
						[
							
							name: "dummy-route"
							request: { }
							response: { }
							
						]
				orchestrations: 
								[
									{
										name: "dummy-orchestration"            
										request: { }
										response: { }
									}
								]
				properties: 
							[ 
								{ property: "prop1", value: "prop1-value1" }
								{ property:"prop2", value: "prop-value1" }
							]               
			transaction.addTransaction testTxDoc, (error, doc) ->
				(doc != null).should.be.true
				doc.should.have.property("applicationID","Musha_OpenMRS")
				transactionId = doc._id
				done()

		it  "should another new transaction db", (done) ->			
			testNewDoc=
				status: "Processing"
				applicationID: "Musha_OpenMRS_testNewDoc"
				request: 
					path: "/api/test"
					headers:   [
									header1: "value1" 
									header2: "value2" 
							]
					requestParams:  [
									param1: "value1" 
									param2: "value2" 
								]
					body: "<HTTP body>"
					method: "POST"
				response: 
					status: 201
					body: "<HTTP body>"
					headers: [
									header1: "value1" 
									header2: "value2" 
					]
				
				routes: 
						[
							
							name: "dummy-route"
							request: { }
							response: { }
							
						]
				orchestrations: 
								[
									{
										name: "dummy-orchestration"            
										request: { }
										response: { }
									}
								]
				properties: 
							[ 
								{ property: "prop1", value: "prop1-value1" }
								{ property:"prop2", value: "prop-value1" }
							]               
			transaction.addTransaction testNewDoc, (error, doc) ->
				(doc != null).should.be.true
				doc.should.have.property("applicationID","Musha_OpenMRS_testNewDoc")
				transactionIdToRemove = doc._id
				done()

	describe ".removeTransaction (transactionId)", ->
		it "should remove the transaction from the db", (done)->
			transaction.removeTransaction transactionIdToRemove, ->
				transaction.findTransactionById transactionIdToRemove, (err, doc) ->
					(doc == null).should.be.true
					done()
    describe ".getTransactions()", ->
       	it "should return all the transactions", (done) ->
        	transaction.getTransactions (err, doc) ->
           		(doc != null).should.be.true
        		done()
        	

    describe ".findTransactionByApplicationId (applicationID)", ->
    	it "should return a transaction specified by applicationID", (done) ->
    		transaction.findTransactionByApplicationId applicationID, (err, docs) ->
    			(docs != null).should.be.true
    			done()

    describe ".updateTransaction(transactionId)", ->
    	it  "should update a transaction specified by transactionId", (done) ->
    		transaction.updateTransaction transactionId, {}, ->
    			transaction.findTransactionByApplicationId transactionId, (err, doc) ->
	            (doc != null).should.be.true
	        	done()
	describe ".findTransactionById(transactionId)", ->
		it  "should return transaction specified by Id", (done)->
			transaction.findTransactionById transactionId, (err, docs) ->
    			(docs != null).should.be.true
    			done()

