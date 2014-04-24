should = require "should"
sinon = require "sinon"
mongoose = require "mongoose"
appcollection = require "../lib/applications"
config = require "../lib/config"
db = null
applicationID = "Rwanda_OpenMRS"
domain = "openhim.squrrel.org"

describe "Applications", ->

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
	testAppDoc =
		applicationID: applicationID
		domain: domain
		name: "OpenMRS Ishmael instance"
		roles: [ 
				"OpenMRS_PoC"
				"PoC" 
			]
		passwordHash: "UUVGFAKLDJAJDKLAKSA"
		cert: "uiewreiuwurfwejhufiiwoekoifwreorfeiwor"

	beforeEach (done)->
		db = mongoose.createConnection config.mongo.url
		collection = db.collection "applications"
		collection.remove {}, (err, numRemoved) ->	
			done()
	afterEach (done)->
		collection = db.collection "applications"
		collection.remove {}, (err, numRecords)->
			done()

	describe ".addApplication(applicationDocument)", ->

		it "should add a new application document to db", (done) ->		

				appcollection.addApplication testAppDoc, (error, doc) ->
					appcollection.findApplicationById doc.applicationID, (error, newAppDoc) ->				
						(newAppDoc != null).should.be.true
						newAppDoc.should.have.property("applicationID", "Rwanda_OpenMRS")
						newAppDoc.should.have.property("domain","openhim.squrrel.org")
						newAppDoc.should.have.property("name","OpenMRS Ishmael instance")
						newAppDoc.roles[0].should.be.exactly "OpenMRS_PoC"
						newAppDoc.roles[1].should.be.exactly "PoC"
						newAppDoc.passwordHash.should.equal "UUVGFAKLDJAJDKLAKSA"
						newAppDoc.cert.should.equal "uiewreiuwurfwejhufiiwoekoifwreorfeiwor"
						done()
		it "should add another application document to db", (done) ->	

			appcollection.addApplication chickenAppDoc, (error, doc) ->
				appcollection.findApplicationById doc.applicationID, (error, newAppDoc) ->				
					newAppDoc.should.be.ok
					newAppDoc.applicationID.should.equal "chicken_openmrs"
					newAppDoc.domain.should.equal "chicken.org"
					newAppDoc.name.should.equal "big meat chicken"
					newAppDoc.roles[0].should.be.exactly "chicken_jembi_chicken"
					newAppDoc.roles[1].should.be.exactly "chicken_poc"
					done()

	describe ".getApplications()", ->
		it  "should return all the applications in the collection", (done) -> 
			appcollection.addApplication chickenAppDoc, (error, doc1) ->
				appcollection.addApplication testAppDoc, (error, doc2) ->
					appcollection.getApplications (error, apps) ->
						(apps != null).should.be.true
						apps.should.have.length(2)
						apps[0].applicationID.should.equal "chicken_openmrs"
						apps[0].domain.should.equal "chicken.org"
						apps[0].name.should.equal "big meat chicken"
						apps[0].roles[0].should.be.exactly "chicken_jembi_chicken"
						apps[0].roles[1].should.be.exactly "chicken_poc"
						done() 

	describe ".findApplicationById(applicationID)", ->
		it  "should return application specified by ID", (done) ->
			appcollection.addApplication testAppDoc, (error, doc) ->
				appcollection.findApplicationById doc.applicationID,(error,newAppDoc) ->
					(newAppDoc != null).should.be.true
					newAppDoc.should.have.property("applicationID", "Rwanda_OpenMRS")
					newAppDoc.should.have.property("domain","openhim.squrrel.org")
					newAppDoc.should.have.property("name","OpenMRS Ishmael instance")
					newAppDoc.roles[0].should.be.exactly "OpenMRS_PoC"
					newAppDoc.roles[1].should.be.exactly "PoC"
					newAppDoc.passwordHash.should.equal "UUVGFAKLDJAJDKLAKSA"
					newAppDoc.cert.should.equal "uiewreiuwurfwejhufiiwoekoifwreorfeiwor"
					done()			

	describe ".findApplicationByDomain(applicationDomain)", ->
		it "should be able to return application with specified domain", (done)->
			appcollection.addApplication testAppDoc, (error, doc) ->			
				appcollection.findApplicationByDomain domain, (error, doc) ->
					(doc != null).should.be.true
					doc.applicationID.should.be.exactly "Rwanda_OpenMRS"
					doc.passwordHash.should.be.exactly "UUVGFAKLDJAJDKLAKSA"
					doc.cert.should.not.be.exactly "uiewreiuwurfwejhufiiwoekoifwreorfeiworfwoeriuewuifhdnfckjnzxncasscjkaskdndfnjkasnc"
					done()
	describe ".updateApplication(applicationID, {})", ->
		it 	"should change the name of the application", (done) ->
			applicationID = "Rwanda_OpenMRS"
			updates = 
					name: "openmrs.jembi.org"
					applicationID: "chicken_openmrs"
					domain:	"pigs.org"
					name: "broken_openmrs"
					roles: [
							"pigs@jembi"
							"none"
							]	
					passwordHash: "IYTQTTXHABJSBASNKASJASoapsapspap"					
					cert: "9930129329201jJKHJsadlksaq81293812kjednejqwk812983291"
			appcollection.addApplication chickenAppDoc, (error, doc) ->			
				appcollection.updateApplication "chicken_openmrs", updates, ->
					appcollection.findApplicationById "chicken_openmrs", (err, updatedApp) ->
						(updatedApp != null).should.be.true
						updatedApp.should.not.have.property "name", "openmrs.jembi.org"
						updatedApp.roles[0].should.equal "pigs@jembi"
						updatedApp.roles[1].should.equal "none"
						updatedApp.applicationID.should.equal "chicken_openmrs"
						updatedApp.domain.should.equal "pigs.org"
						updatedApp.passwordHash.should.not.equal "ngonidzashe"
						updatedApp.cert.should.not.equal "ngonidzashe"
						done()
		
	describe ".removeApplication(applicationID)", ->
		it  "should remove the application with provided applicationID", (done) ->			
			applicationID = "chicken_openmrs"
			appcollection.addApplication chickenAppDoc, (error, doc) ->			
				appcollection.removeApplication "chicken_openmrs", ->
					appcollection.findApplicationById "chicken_openmrs", (err, doc) ->
						(doc == null).should.be.true						
						done()
