should = require "should"
sinon = require "sinon"
appcollection = require "../lib/applications"

describe "Applications", ->

	describe ".register(applicationDocument)", ->

		it "should return the newly added Application as contained in the application-json-document", (done) ->			
			testAppDoc =
					applicationId: "Ishmael_OpenMRS"
					domain: "him.jembi.org"
					name: "OpenMRS Ishmael instance"
					roles: [ 
							"OpenMRS_PoC"
							"PoC" 
						]
					passwordHash: ""
					cert: ""

			testAppDocx =
					applicationId: "Ishmael_OpenMRS_2"
					domain: "him.jembi.org"
					name: "OpenMRS Ishmael SECOND instance"
					roles: [ 
							"OpenMRS_PoC" 
						]
					passwordHash: "HASH-DASH"
					cert: ""				

			appcollection.addApplication testAppDoc, (error, newAppDoc) ->
					(newAppDoc != null).should.be.true
					newAppDoc.should.have.property("applicationId", "Ishmael_OpenMRS")
					
			appcollection.addApplication testAppDocx, (error, doc) ->
					(doc != null).should.be.true
					doc.should.have.property("applicationId", "Ishmael_OpenMRS_2")					
					done()

describe ".findAllApplications(applicationId)", ->

		it "should return the Transaction JSON specified by the ID", (done) ->  
			id = "Musha_OpenMRS"      
			appcollection.findAll (error, doc) ->
				(doc != null).should.be.true
				doc.should.have.length(2)
				done() 