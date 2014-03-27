should = require "should"
sinon = require "sinon"
mongoose = require "mongoose"
appcollection = require "../lib/applications"

describe "Applications", ->

	before (done)->
		for i of mongoose.connection.collections
			mongoose.connection.collections[i].remove ->
		done()
	after (done)->
		mongoose.disconnect ->
		done()

	describe ".register(applicationDocument)", ->

		it "should return the newly added Application as contained in the application-json-document", (done) ->		

			testAppDoc =
					applicationId: "Rwanda_OpenMRS"
					domain: "openhim.jembi.org"
					name: "OpenMRS Ishmael instance"
					roles: [ 
							"OpenMRS_PoC"
							"PoC" 
						]
					passwordHash: "UUVGFAKLDJAJDKLAKSA"
					cert: "uiewreiuwurfwejhufiiwoekoifwreorfeiworfwoeriuewuifhdnfckjnzxncasscjkaskdndfnjkasnc"
			chickenAppDoc =
					applicationId: "chicken_openmrs"
					domain:	"chicken.org"
					name: "big meat chicken"
					roles: [
							"chicken_jembi_chicken"
							"chicken_poc"
					]
					passwordHash: "IYTQTTXHABJSBASNKASJASoapsapspap"
					cert: "9930129329201jJKHJsadlksaq81293812kjednejqwk812983291"
			appcollection.addApplication testAppDoc, (error, newAppDoc) ->
				(newAppDoc != null).should.be.true
				newAppDoc.should.have.property("applicationId", "Rwanda_OpenMRS")
				newAppDoc.should.have.property("domain","openhim.jembi.org")
			

			appcollection.addApplication chickenAppDoc, (error, doc) ->
				doc.should.be.ok
				doc.applicationId.should.equal "chicken_openmrs"
			done()

	describe ".findAll()", ->
		it  "should return all the applications in the collection", (done) ->     
			appcollection.findAll (error, doc) ->
				(doc != null).should.be.true
				doc.should.have.length(2)
				done() 

	describe ".findApplicationById(applicationId)", ->
		it  "should return application specified by ID", (done) ->
			id = "Rwanda_OpenMRS"
			appcollection.findApplicationById id,(error,doc) ->
				(doc != null).should.be.true
				doc.domain.should.equal "openhim.jembi.org"
				doc.name.should.equal "OpenMRS Ishmael instance"				
			done()

	describe ".findApplicationByDomain(applicationDomain)", ->
		it "should be able to return application with specified domain", (done)->
			domain = "openhim.jembi.org"
			appcollection.findApplicationByDomain domain, (error, doc) ->
				(doc != null).should.be.ok
				doc.applicationId.should.be.exactly "Rwanda_OpenMRS"
				doc.passwordHash.should.be.exactly "UUVGFAKLDJAJDKLAKSA"
				doc.cert.should.be.exactly "uiewreiuwurfwejhufiiwoekoifwreorfeiworfwoeriuewuifhdnfckjnzxncasscjkaskdndfnjkasnc"
			done()
	describe ".updateApplication(applicationId, {})", ->
		it 	"should change the name of the application", (done) ->
			applicationId = "Rwanda_OpenMRS"
			updates = 
					name: "jembi open mrs"
			appcollection.updateApplication applicationId, updates, ->
				appcollection.findApplicationById applicationId, (err, doc) ->
					(doc != null).should.be.true
					doc.should.have.property "name", "jembi open mrs"
					doc.roles[0].should.equal "OpenMRS_PoC"
					doc.roles[1].should.equal "PoC"
			done()
	
	describe ".removeApplication(applicationId)", ->
		it  "should remove the application with provided applicationId", (done) ->
			applicationId = "chicken_openmrs"
			appcollection.removeApplication applicationId, ->
				appcollection.findApplicationById applicationId, (err, doc) ->
					(doc == null).should.be.true
			done()
	
