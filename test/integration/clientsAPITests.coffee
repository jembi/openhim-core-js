should = require "should"
request = require "supertest"
Client = require("../../lib/model/clients").Client
server = require "../../lib/server"
auth = require("../testUtils").auth
testUtils = require "../testUtils"

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
			passwordHash: "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
			cert: "8fajd89ada"

		authDetails = auth.getAuthDetails()

		before (done) ->
			auth.setupTestUser (err) ->
				done()

		after (done) ->
			auth.cleanupTestUser (err) ->
				done()

		afterEach (done) ->
			server.stop ->
				Client.remove ->
					done()

		describe ".addClient", ->

			it  "should add client to db and return status 201 - client created", (done) ->     

				server.start null, null, 8080,  ->
					request("http://localhost:8080")
						.post("/clients")
						.set("auth-username", authDetails.authUsername)
						.set("auth-ts", authDetails.authTS)
						.set("auth-salt", authDetails.authSalt)
						.set("auth-token", authDetails.authToken)
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
									client.passwordHash.should.equal "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
									client.cert.should.equal "8fajd89ada"
									done()

		describe ".getClient", ->
			clientTest =
				clientID: "testClient"
				domain: "www.zedmusic-unique.co.zw"
				name: "OpenHIE NodeJs"
				roles: [
						"test_role_PoC"
						"monitoring"
					]
				passwordHash: "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
				cert: ""

			beforeEach (done) ->
				client = new Client clientTest
				client.save (err, client) ->
					done err if err
					done()

			it "should get client by clientId and return status 200", (done) ->
				server.start null, null, 8080,  ->
					request("http://localhost:8080")
						.get("/clients/testClient")
						.set("auth-username", authDetails.authUsername)
						.set("auth-ts", authDetails.authTS)
						.set("auth-salt", authDetails.authSalt)
						.set("auth-token", authDetails.authToken)
						.expect(200)
						.end (err, res) ->
							if err
								done err
							else
								res.body.clientID.should.equal "testClient"
								res.body.domain.should.equal "www.zedmusic-unique.co.zw"
								res.body.name.should.equal "OpenHIE NodeJs"
								res.body.roles[0].should.equal "test_role_PoC"
								res.body.roles[1].should.equal "monitoring"
								res.body.passwordHash.should.equal "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
								res.body.cert.should.equal ""
								done()

			it "should return status 404 if not found", (done) ->
				server.start null, null, 8080,  ->
					request("http://localhost:8080")
						.get("/clients/nonexistent")
						.set("auth-username", authDetails.authUsername)
						.set("auth-ts", authDetails.authTS)
						.set("auth-salt", authDetails.authSalt)
						.set("auth-token", authDetails.authToken)
						.expect(404)
						.end (err, res) ->
							if err
								done err
							else
								done()


		describe ".findClientByDomain(domain)", ->
			clientTest =
				clientID: "Zambia_OpenHIE_Instance"
				domain: "www.zedmusic-unique.co.zw"
				name: "OpenHIE NodeJs"
				roles: [
						"test_role_PoC"
						"monitoring"
					]
				passwordHash: "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
				cert: ""

			it "should return client with specified domain", (done) ->
				client = new Client clientTest
				client.save (error, newApp) ->
					should.not.exist (error)
					server.start null, null, 8080,  ->
						request("http://localhost:8080")
							.get("/clients/domain/www.zedmusic-unique.co.zw")
							.set("auth-username", authDetails.authUsername)
							.set("auth-ts", authDetails.authTS)
							.set("auth-salt", authDetails.authSalt)
							.set("auth-token", authDetails.authToken)
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
									res.body.passwordHash.should.equal "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
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
				passwordHash: "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
				cert: "12345"
			it  "should return all clients ", (done) ->
				Client.count (err, countBefore)->
					client = new Client testDocument
					client.save (error, testDoc) ->
						should.not.exist (error)
						client = new Client testDocument
						client.save (error, testDoc) ->
							should.not.exist(error)
							client = new Client testDocument
							client.save (error, testDoc) ->
								should.not.exist(error)
								client = new Client testDocument
								client.save (error, testDoc) ->
									should.not.exist (error)
									server.start null, null, 8080,  ->
										request("http://localhost:8080")
											.get("/clients")
											.set("auth-username", authDetails.authUsername)
											.set("auth-ts", authDetails.authTS)
											.set("auth-salt", authDetails.authSalt)
											.set("auth-token", authDetails.authToken)
											.expect(200)
											.end (err, res) ->
												if err
													done err
												else
													res.body.length.should.equal countBefore + 4
													done()

		describe  ".updateClient", ->
			clientID = "Botswana_OpenHIE_Instance"
			testDocument =
				clientID: clientID
				domain: "www.zedmusic.co.zw"
				name: "OpenHIE NodeJs"
				roles: [
						"test_role_PoC"
						"analysis_POC"
					]
				passwordHash: "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
				cert: "12345"

			it "should update the specified client ", (done) ->
				client = new Client testDocument
				client.save (error, testDoc) ->
					should.not.exist (error)

					updates =
						_id: "thisShouldBeIgnored"
						roles: 	[
									"clientTest_update"
								]
						passwordHash: "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
						name: "Devil_may_Cry"
					server.start null, null, 8080,  ->
						request("http://localhost:8080")
							.put("/clients/#{clientID}")
							.set("auth-username", authDetails.authUsername)
							.set("auth-ts", authDetails.authTS)
							.set("auth-salt", authDetails.authSalt)
							.set("auth-token", authDetails.authToken)
							.send(updates)
							.expect(200)
							.end (err, res) ->
								if err
									done err
								else
									Client.findOne { clientID: clientID }, (error, clientDoc) ->
										clientDoc.roles[0].should.equal "clientTest_update"
										clientDoc.passwordHash.should.equal "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
										clientDoc.name.should.equal "Devil_may_Cry"
									done()

			it "should update successfully if the _id field is present in update, ignoring it", (done) ->
				client = new Client testDocument
				client.save (error, testDoc) ->
					should.not.exist (error)

					updates =
						_id: "not_a_real_id"
						roles: 	[
									"clientTest_update"
								]
						passwordHash: "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
						name: "Devil_may_Cry"
					server.start null, null, 8080,  ->
						request("http://localhost:8080")
							.put("/clients/#{clientID}")
							.set("auth-username", authDetails.authUsername)
							.set("auth-ts", authDetails.authTS)
							.set("auth-salt", authDetails.authSalt)
							.set("auth-token", authDetails.authToken)
							.send(updates)
							.expect(200)
							.end (err, res) ->
								if err
									done err
								else
									Client.findOne { clientID: clientID }, (error, clientDoc) ->
										clientDoc.roles[0].should.equal "clientTest_update"
										clientDoc.passwordHash.should.equal "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
										clientDoc.name.should.equal "Devil_may_Cry"
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
					passwordHash: "$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy"
					cert: "1098765"
				client = new Client docTestRemove
				client.save (error, testDoc) ->
					should.not.exist(error)	
					Client.count (err, countBefore) ->
						server.start null, null, 8080,  ->
							request("http://localhost:8080")
								.del("/clients/Jembi_OpenHIE_Instance")
								.set("auth-username", authDetails.authUsername)
								.set("auth-ts", authDetails.authTS)
								.set("auth-salt", authDetails.authSalt)
								.set("auth-token", authDetails.authToken)
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
