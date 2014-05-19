should = require "should"
request = require "supertest"
Client = require("../../lib/model/clients").Client
server = require "../../lib/server"

describe "API Integration Tests", ->

	describe "Clients REST Api Testing", ->
		testAppDoc =
			clientID: "YUIAIIIICIIAIA"
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
				Client.remove ->
					done()				

		describe ".addClient", ->

			it  "should add client to db and return status 201 - client created", (done) ->     

				server.start null, null, 8080,  ->
					request("http://localhost:8080")
						.post("/clients")
						.send(testAppDoc)
						.expect(201)
						.end (err, res) ->
							if err
								done err
							else
								Client.findOne { clientID: "YUIAIIIICIIAIA" }, (err, client) ->
									client.clientID.should.equal "YUIAIIIICIIAIA"
									client.domain.should.equal "him.jembi.org"
									client.name.should.equal "OpenMRS Ishmael instance"
									client.roles[0].should.equal "OpenMRS_PoC"
									client.roles[1].should.equal "PoC"
									client.passwordHash.should.equal "842j3j8m232n28u32"
									client.cert.should.equal "8fajd89ada"
									done()
			

		describe ".findClientByDomain(domain)", ->
			appTest =
				clientID: "Zambia_OpenHIE_Instance"
				domain: "www.zedmusic-unique.co.zw"
				name: "OpenHIE NodeJs"
				roles: [ 
						"test_role_PoC"
						"monitoring" 
					]
				passwordHash: "67278372732jhfhshs"
				cert: ""					

			it "should return client with specified domain", (done) ->
				app = new Client appTest
				app.save (error, newApp) ->
					should.not.exist (error)
					server.start null, null, 8080,  ->
						request("http://localhost:8080")
							.get("/clients/domain/www.zedmusic-unique.co.zw")
							.expect(200)
							.end (err, res) ->
								if err
									done err
								else
									res.body.clientID.should.equal "Zambia_OpenHIE_Instance"
									res.body.domain.should.equal "www.zedmusic-unique.co.zw"
									res.body.name.should.equal "OpenHIE NodeJs"
									res.body.roles[0].should.equal "test_role_PoC"
									res.body.roles[1].should.equal "monitoring"
									res.body.passwordHash.should.equal "67278372732jhfhshs"
									res.body.cert.should.equal ""
									done()

		describe  ".getClients", ->
			testDocument =
				clientID: "Botswana_OpenHIE_Instance"
				domain: "www.zedmusic.co.zw"
				name: "OpenHIE NodeJs"
				roles: [ 
						"test_role_PoC"
						"analysis_POC" 
					]
				passwordHash: "njdjasjajjudq98892"
				cert: "12345"
			it  "should return all clients ", (done) ->
				Client.count (err, countBefore)->
					app = new Client testDocument
					app.save (error, testDoc) ->
						should.not.exist (error)
						app = new Client testDocument
						app.save (error, testDoc) ->
							should.not.exist(error)
							app = new Client testDocument
							app.save (error, testDoc) ->
								should.not.exist(error)
								app = new Client testDocument
								app.save (error, testDoc) ->
									should.not.exist (error)
									server.start null, null, 8080,  ->
										request("http://localhost:8080")
											.get("/clients")
											.expect(200)
											.end (err, res) ->
												if err
													done err
												else
													res.body.length.should.equal countBefore + 4
													done()

		describe  ".updateClient", ->
			it 	"should update the specified client ", (done) ->
				clientID = "Botswana_OpenHIE_Instance"
				testDocument =
					clientID: clientID
					domain: "www.zedmusic.co.zw"
					name: "OpenHIE NodeJs"
					roles: [ 
							"test_role_PoC"
							"analysis_POC" 
						]
					passwordHash: "njdjasjajjudq98892"
					cert: "12345"
				app = new Client testDocument
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
							.put("/clients/#{clientID}")
							.send(updates)
							.expect(200)
							.end (err, res) ->													
								if err
									done err
								else
									Client.findOne { clientID: clientID }, (error, appDoc) ->
										appDoc.roles[0].should.equal "appTest_update"
										appDoc.passwordHash.should.equal "kakakakakaka"
										appDoc.name.should.equal "Devil_may_Cry"
									done()

		describe ".removeClient", ->
			it  "should remove an client with specified clientID", (done) ->
				docTestRemove =
					clientID: "Jembi_OpenHIE_Instance"
					domain: "www.jembi.org"
					name: "OpenHIE NodeJs"
					roles: [ 
							"test_role_PoC"
							"analysis_POC" 
						]
					passwordHash: "njdjasjajjudq98892"
					cert: "1098765"
				app = new Client docTestRemove
				app.save (error, testDoc) ->
					should.not.exist(error)	
					Client.count (err, countBefore) ->				
						server.start null, null, 8080,  ->
							request("http://localhost:8080")
								.del("/clients/Jembi_OpenHIE_Instance")
								.expect(200)
								.end (err, res) ->
									if err
										done err
									else
										Client.count (err, countAfter) ->
											Client.findOne { clientID: "Jembi_OpenHIE_Instance" }, (error, notFoundDoc) ->
												(notFoundDoc == null).should.be.true
												(countBefore - 1).should.equal countAfter
												done()
