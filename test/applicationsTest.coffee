should = require "should"
sinon = require "sinon"
mongoose = require "mongoose"
appcollection = require "../lib/applications"
config = require "../lib/config"
db = null
applicationID = "Rwanda_OpenMRS"
domain = "openhim.squrrel.org"

describe "Applications", ->

	before (done)->
		db = mongoose.createConnection config.mongo.url
		collection = db.collection "applications"
		collection.remove {}, (err, numRemoved) ->	
			done()
	after (done)->
		collection = db.collection "applications"
		collection.remove {}, (err, numRecords)->
			done()

	describe ".addApplication(applicationDocument)", ->

		it "should add a new application document to db", (done) ->		

			testAppDoc =
					applicationID: applicationID
					domain: domain
					name: "OpenMRS Ishmael instance"
					roles: [ 
							"OpenMRS_PoC"
							"PoC" 
						]
					passwordHash: "UUVGFAKLDJAJDKLAKSA"
					cert: "uiewreiuwurfwejhufiiwoekoifwreorfeiworfwoeriuewuifhdnfckjnzxncasscjkaskdndfnjkasnc"
				appcollection.addApplication testAppDoc, (error, newAppDoc) ->
					(newAppDoc != null).should.be.true
					newAppDoc.should.have.property("applicationID", "Rwanda_OpenMRS")
					newAppDoc.should.have.property("domain","openhim.squrrel.org")
					done()
		it "should add another application document to db", (done) ->	
			chickenAppDoc=	
					applicationID: "chicken_openmrs"
					domain:	"chicken.org"
					name: "big meat chicken"
					roles: [
							"chicken_jembi_chicken"
							"chicken_poc"
					]
					passwordHash: "IYTQTTXHABJSBASNKASJASoapsapspap"
					cert: "9930129329201jJKHJsadlksaq81293812kjednejqwk812983291"

			appcollection.addApplication chickenAppDoc, (error, doc) ->
				doc.should.be.ok
				doc.applicationID.should.equal "chicken_openmrs"
				doc.domain.should.equal "chicken.org"
				doc.name.should.equal "big meat chicken"
				doc.roles[0].should.be.exactly "chicken_jembi_chicken"
				doc.roles[1].should.be.exactly "chicken_poc"
				done()

	describe ".getApplications()", ->
		it  "should return all the applications in the collection", (done) ->     
			appcollection.getApplications (error, doc) ->
				(doc != null).should.be.true
				doc.should.have.length(2)
				done() 

	describe ".findApplicationById(applicationID)", ->
		it  "should return application specified by ID", (done) ->
			appcollection.findApplicationById applicationID,(error,doc) ->
				(doc != null).should.be.true
				doc.domain.should.equal domain
				doc.applicationID.should.be.exactly applicationID
				doc.roles[0].should.equal "OpenMRS_PoC"
				done()			

	describe ".findApplicationByDomain(applicationDomain)", ->
		it "should be able to return application with specified domain", (done)->			
			appcollection.findApplicationByDomain domain, (error, doc) ->
				(doc != null).should.be.true
				doc.applicationID.should.be.exactly "Rwanda_OpenMRS"
				doc.passwordHash.should.be.exactly "UUVGFAKLDJAJDKLAKSA"
				doc.cert.should.be.exactly "uiewreiuwurfwejhufiiwoekoifwreorfeiworfwoeriuewuifhdnfckjnzxncasscjkaskdndfnjkasnc"
				done()
	describe ".updateApplication(applicationID, {})", ->
		it 	"should change the name of the application", (done) ->
			applicationID = "Rwanda_OpenMRS"
			updates = 
					name: "jembi open mrs"
			appcollection.updateApplication applicationID, updates, ->
				appcollection.findApplicationById applicationID, (err, doc) ->
					(doc != null).should.be.true
					doc.should.have.property "name", "jembi open mrs"
					doc.roles[0].should.equal "OpenMRS_PoC"
					doc.roles[1].should.equal "PoC"
					done()
	
	describe ".removeApplication(applicationID)", ->
		it  "should remove the application with provided applicationID", (done) ->
			applicationID = "chicken_openmrs"
			appcollection.removeApplication applicationID, ->
				appcollection.findApplicationById applicationID, (err, doc) ->
					(doc == null).should.be.true
					done()