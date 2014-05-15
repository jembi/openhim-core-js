should = require "should"
request = require "supertest"
Application = require("../../lib/model/applications").Application
server = require "../../lib/server"

describe "API Integration Tests", ->

	describe "Applications REST Api Testing", ->
		testAppDoc =
			applicationID: "YUIAIIIICIIAIA"
			domain: "him.jembi.org"
			name: "OpenMRS Ishmael instance"
			roles: [ 
					"OpenMRS_PoC"
					"PoC" 
				]
			passwordHash: "842j3j8m232n28u32"
			cert: "8fajd89ada"

		afterEach (done) ->
			server.stop ->
				Application.remove ->
					done()				

		describe ".addApplication", ->

			it  "should add application to db and return status 201 - application created", (done) ->     

				server.start null, null, 8080,  ->
					request("http://localhost:8080")
						.post("/applications")
						.send(testAppDoc)
						.expect(201)
						.end (err, res) ->
							if err
								done err
							else
								Application.findOne { applicationID: "YUIAIIIICIIAIA" }, (err, application) ->
									application.applicationID.should.equal "YUIAIIIICIIAIA"
									application.domain.should.equal "him.jembi.org"
									application.name.should.equal "OpenMRS Ishmael instance"
									application.roles[0].should.equal "OpenMRS_PoC"
									application.roles[1].should.equal "PoC"
									application.passwordHash.should.equal "842j3j8m232n28u32"
									application.cert.should.equal "8fajd89ada"
									done()
			

		describe ".findApplicationByDomain(domain)", ->
			appTest =
				applicationID: "Zambia_OpenHIE_Instance"
				domain: "www.zedmusic-unique.co.zw"
				name: "OpenHIE NodeJs"
				roles: [ 
						"test_role_PoC"
						"monitoring" 
					]
				passwordHash: "67278372732jhfhshs"
				cert: ""					

			it "should return application with specified domain", (done) ->
				app = new Application appTest
				app.save (error, newApp) ->
					should.not.exist (error)
					server.start null, null, 8080,  ->
						request("http://localhost:8080")
							.get("/applications/domain/www.zedmusic-unique.co.zw")
							.expect(200)
							.end (err, res) ->
								if err
									done err
								else
									res.body.applicationID.should.equal "Zambia_OpenHIE_Instance"
									res.body.domain.should.equal "www.zedmusic-unique.co.zw"
									res.body.name.should.equal "OpenHIE NodeJs"
									res.body.roles[0].should.equal "test_role_PoC"
									res.body.roles[1].should.equal "monitoring"
									res.body.passwordHash.should.equal "67278372732jhfhshs"
									res.body.cert.should.equal ""
									done()

		describe  ".getApplications", ->
			testDocument =
				applicationID: "Botswana_OpenHIE_Instance"
				domain: "www.zedmusic.co.zw"
				name: "OpenHIE NodeJs"
				roles: [ 
						"test_role_PoC"
						"analysis_POC" 
					]
				passwordHash: "njdjasjajjudq98892"
				cert: "12345"
			it  "should return all applications ", (done) ->
				Application.count (err, countBefore)->
					app = new Application testDocument
					app.save (error, testDoc) ->
						should.not.exist (error)
						app = new Application testDocument
						app.save (error, testDoc) ->
							should.not.exist(error)
							app = new Application testDocument
							app.save (error, testDoc) ->
								should.not.exist(error)
								app = new Application testDocument
								app.save (error, testDoc) ->
									should.not.exist (error)
									server.start null, null, 8080,  ->
										request("http://localhost:8080")
											.get("/applications")
											.expect(200)
											.end (err, res) ->
												if err
													done err
												else
													res.body.length.should.equal countBefore + 4
													done()

		describe  ".updateApplication", ->
			it 	"should update the specified application ", (done) ->
				applicationID = "Botswana_OpenHIE_Instance"
				testDocument =
					applicationID: applicationID
					domain: "www.zedmusic.co.zw"
					name: "OpenHIE NodeJs"
					roles: [ 
							"test_role_PoC"
							"analysis_POC" 
						]
					passwordHash: "njdjasjajjudq98892"
					cert: "12345"
				app = new Application testDocument
				app.save (error, testDoc) ->
					should.not.exist (error)

					updates =
						roles: 	[
									"appTest_update"
								]
						passwordHash: "kakakakakaka"
						name: "Devil_may_Cry"
					server.start null, null, 8080,  ->
						request("http://localhost:8080")
							.put("/applications/#{applicationID}")
							.send(updates)
							.expect(200)
							.end (err, res) ->													
								if err
									done err
								else
									Application.findOne { applicationID: applicationID }, (error, appDoc) ->
										appDoc.roles[0].should.equal "appTest_update"
										appDoc.passwordHash.should.equal "kakakakakaka"
										appDoc.name.should.equal "Devil_may_Cry"
									done()

		describe ".removeApplication", ->
			it  "should remove an application with specified applicationID", (done) ->
				docTestRemove =
					applicationID: "Jembi_OpenHIE_Instance"
					domain: "www.jembi.org"
					name: "OpenHIE NodeJs"
					roles: [ 
							"test_role_PoC"
							"analysis_POC" 
						]
					passwordHash: "njdjasjajjudq98892"
					cert: "1098765"
				app = new Application docTestRemove
				app.save (error, testDoc) ->
					should.not.exist(error)	
					Application.count (err, countBefore) ->				
						server.start null, null, 8080,  ->
							request("http://localhost:8080")
								.del("/applications/Jembi_OpenHIE_Instance")
								.expect(200)
								.end (err, res) ->
									if err
										done err
									else
										Application.count (err, countAfter) ->
											Application.findOne { applicationID: "Jembi_OpenHIE_Instance" }, (error, notFoundDoc) ->
												(notFoundDoc == null).should.be.true
												(countBefore - 1).should.equal countAfter
												done()
