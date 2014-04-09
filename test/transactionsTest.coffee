should = require "should"
sinon = require "sinon"
mongoose = require "mongoose"
transaction = require "../lib/transactions"
config = require "../lib/config"

db = null

collection = null
transactionId = null
applicationID = "Musha_OpenMRS_testNewDoc"
transactionIdToRemove = null

beforeEach (done)->
	db = mongoose.createConnection config.mongo.url
	collection = db.collection "transactions"
	collection.remove {}, (err, numRemoved) ->	
		done()
afterEach (done)->
	collection = db.collection "transactions"
	collection.remove {}, (err, numRecords)->
		done()	


describe "Transactions", ->
	request = new Object()
	request.path = "/api/test/request"
	request.headers = 	[	
							header: "headerName"
							value: "headerValue"
						,
							header: "Content-Type"
							value: "application/json"
						,
							header: "Content-Length"
							value: "9313219921"
						]	

	request.requestParams = [
							parameter: "parameterName" 
							value: "parameterValue" 			
						]
	request.body = "<HTTP body>"
	request.method = "POST"
	request.timestamp = new Date()

	response = new Object()
	response.status = "200"
	response.headers= 	[
							header:"header1"
							value:"value2"
						]
	response.body = "<HTTP response>"
	response.timestamp = new Date()

	testNewDoc=
		status: "Processing"
		applicationID: "Musha_OpenMRS_testNewDoc"
		request: [request]
		response: [response]
		routes: [							
					name: "jembi.org"
					request: [request]
					response: [response]							
				]
		orchestrations: [
							{
								name: "validate provider"            
								request: [request]
								response: [response]
							}
						]
		properties: 
					[ 
						{ property: "prop1", value: "prop1-value1" }
						{ property:"prop2", value: "prop-value1" }
					] 
			
	describe ".addTransaction(transactionJson)", ->
		it "should add new transaction to db", (done)-> 
			transaction.addTransaction testNewDoc, (error, newTrans) ->
				should.not.exist(error)
				transaction.findTransactionById newTrans._id, (err, insertedDoc) ->
					should.exist insertedDoc
					(insertedDoc != null).should.be.true
					insertedDoc.status.should.be.equal "Processing"
					insertedDoc.should.have.property("applicationID","Musha_OpenMRS_testNewDoc")					
					insertedDoc.request[0].path.should.equal "/api/test/request"
					insertedDoc.request[0].headers[1].header.should.equal "Content-Type"
					insertedDoc.request[0].headers[1].value.should.equal "application/json"
					insertedDoc.request[0].body.should.equal "<HTTP body>"
					insertedDoc.request[0].method.should.equal "POST"
					insertedDoc.response[0].status.should.equal 200
					insertedDoc.response[0].headers[0].header.should.equal "header1"
					insertedDoc.response[0].headers[0].value.should.equal "value2"
					done()

	describe ".updateTransaction(transactionId)", ->

		it  "should update a transaction specified by transactionId", (done) ->
			newTransaction=
				status: "Processing"
				applicationID: "JEMBI_projects_openmrs"
				request: [request]
				response: [response]
				routes: [							
							name: "jembi.org"
							request: [request]
							response: [response]							
						]
				orchestrations: [
									{
										name: "validate provider"            
										request: [request]
										response: [response]
									}
								]
				properties: 
							[ 
								{ property: "prop1", value: "prop1-value1" }
								{ property:"prop2", value: "prop-value1" }
							]
			
			req = new Object() 
			req.path = "/api/transactions/delete/guuid"
			req.headers = 	[
								header:"Accept"
								value:"type/plain; q=0.5, text/html, text/x-dvi"
							,
								header:"Accept-Language"
								value: "da,en-gb"
							]
			updates =
				status: "Completed"
				applicationID: "Project_SINAYE_0989"
				request: [req]
				properties: [
								property: "serverName"
								value: "casper-ghost"
							,
								property: "credentials"
								value: "username-password"
							,
								property: "modified-date"
								value:"Tuesday 27 April 1995"
							]
			transaction.addTransaction newTransaction, (error, newTrans) ->
				transactionId = newTrans._id
				transaction.updateTransaction newTrans._id, updates, ->
					transaction.findTransactionById newTrans._id, (err, updatedTransaction) ->
						should.not.exist(err)
						(updatedTransaction != null).should.be.true
						updatedTransaction.status.should.equal "Completed"
						updatedTransaction.applicationID.should.equal "Project_SINAYE_0989"
						updatedTransaction.request[0].path.should.equal "/api/transactions/delete/guuid"
						updatedTransaction.request[0].headers[0].header.should.equal "Accept"
						updatedTransaction.request[0].headers[0].value.should.equal "type/plain; q=0.5, text/html, text/x-dvi"
						updatedTransaction.request[0].headers[1].header.should.equal "Accept-Language"
						updatedTransaction.request[0].headers[1].value.should.equal "da,en-gb"
						updatedTransaction.properties[0].property.should.equal "serverName"
						updatedTransaction.properties[0].value.should.equal "casper-ghost"
						updatedTransaction.properties[1].property.should.equal "credentials"
						updatedTransaction.properties[1].value.should.equal "username-password"
						updatedTransaction.properties[2].property.should.equal "modified-date"
						updatedTransaction.properties[2].value.should.equal "Tuesday 27 April 1995"
						done()

	describe ".getTransactions()", ->

		it "should return all transactions", (done) ->
			transaction.addTransaction testNewDoc, (error, newTrans) ->
				transaction.addTransaction testNewDoc, (error, newTrans) ->
					transaction.getTransactions (error, transactions) ->
						(transactions != null).should.be.true
						transactions.should.have.length 2
						done()

	describe ".findTransactionByApplicationId (applicationID)", ->
		docTest=
			status: "Processing"
			applicationID: "JEMBI_projects_openmrs_YQWA"
			request: [request]
			response: [response]
			routes: [							
						name: "jembi.org"
						request: [request]
						response: [response]							
					]
			orchestrations: [
								{
									name: "validate provider"            
									request: [request]
									response: [response]
								}
							]
			properties: 
						[ 
							{ property: "prop1", value: "prop1-value" }
							{ property: "prop2", value: "prop2-value" }
						] 
		it "should return a transaction specified by applicationID", (done) ->
			transaction.addTransaction docTest, (error, newTrans) ->
				transaction.addTransaction docTest, (error, newTrans) ->
					transaction.findTransactionByApplicationId "JEMBI_projects_openmrs_YQWA", (err, docs) ->
						(docs != null).should.be.true
						docs.should.have.length 2
						docs[0].applicationID.should.equal "JEMBI_projects_openmrs_YQWA"
						docs[0].status.should.equal "Processing"
						docs[0].properties[0].property.should.equal "prop1"
						docs[0].properties[1].property.should.equal "prop2"
						docs[0].properties[0].value.should.equal "prop1-value"
						docs[0].properties[1].value.should.equal "prop2-value"
						done()

	describe ".findTransactionById(transactionId)", ->

		docTestFindById=
			status: "Processing"
			applicationID: "JEMBI_projects_openmrs_YQWA"
			request: [request]
			response: [response]
			routes: [							
						name: "jembi.org"
						request: [request]
						response: [response]							
					]
			orchestrations: [
								{
									name: "validate provider"            
									request: [request]
									response: [response]
								}
							]
			properties: 
						[ 
							{ property: "applicationName", value: "SHR" }
							{ property:"location", value: "Rwanda" }
						] 

		it  "should return transaction specified by Id", (done)->
			transaction.addTransaction docTestFindById, (error, newTrans) ->
				transactionId = newTrans._id
				transaction.findTransactionById transactionId, (err, transaction) ->
					should.exist transaction
					(transaction != null).should.be.true
					transaction.status.should.equal "Processing"
					transaction.applicationID.should.equal "JEMBI_projects_openmrs_YQWA"
					transaction.request[0].path.should.equal "/api/test/request"
					transaction.properties[0].property.should.equal "applicationName"
					transaction.properties[1].property.should.equal "location"
					transaction.properties[0].value.should.equal "SHR"
					transaction.properties[1].value.should.equal "Rwanda"
					transaction.orchestrations[0].name.should.equal "validate provider"
					done()

	describe ".removeTransaction (transactionId)", ->
		docTestRemoveById=
			status: "Processing"
			applicationID: "JEMBI_projects_openmrs_YQWA"
			request: [request]
			response: [response]
			routes: [							
						name: "jembi.org"
						request: [request]
						response: [response]							
					]
			orchestrations: [
								{
									name: "validate provider"            
									request: [request]
									response: [response]
								}
							]
			properties: 
						[ 
							{ property: "prop1", value: "prop1-value1" }
							{ property:"prop2", value: "prop-value1" }
						] 

		it "should remove the transaction from the db", (done)->
			transaction.addTransaction docTestRemoveById, (error, newTrans) ->
				transactionIdToRemove = newTrans._id
				transaction.removeTransaction newTrans._id, ->
					transaction.findTransactionById transactionIdToRemove, (err, transaction) ->
						(transaction == null).should.be.true
						done()