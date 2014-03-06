should = require "should"
sinon = require "sinon"
appcollection = require "../lib/applications"

describe "Applications", ->

	describe ".register(applicationDocument)", ->

		it "should return the newly added Application as contained in the application-json-document", (done) ->			
			testAppDoc =
					applicationID: "Ishmael_OpenMRS"
					domain: "him.jembi.org"
					name: "OpenMRS Ishmael instance"
					roles: [ 
							"OpenMRS_PoC"
							"PoC" 
						]
					passwordHash: ""
					cert: ""					

			appcollection.addApplication testAppDoc, (error, newAppDoc)->
					(newAppDoc != null).should.be.true
					newAppDoc.should.have.property("applicationID", "Ishmael_OpenMRS")
					done()