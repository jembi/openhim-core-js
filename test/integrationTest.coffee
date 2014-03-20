should = require "should"
sinon = require "sinon"
https = require "https"
fs = require "fs"
request = require "supertest"
config = require "../lib/config"
router = require "../lib/router"
applications = require "../lib/applications"
testUtils = require "./testUtils"

server = require "../lib/server"

describe "Integration Tests", ->

	describe "Auhentication and authorisation tests", ->

		describe "Mutual TLS", ->

			mockServer = null

			before (done) ->
				config.authentication.enableMutualTLSAuthentication = true
				config.authentication.enableBasicAuthentication = false

				#Setup some test data
				channel1 =
					name: "TEST DATA - Mock endpoint"
					urlPattern: "test/mock"
					allow: [ "PoC" ]
					routes: [
								host: "localhost"
								port: 1232
								primary: true
							]
				router.addChannel channel1, (err) ->
					testAppDoc =
						applicationID: "testApp"
						domain: "test-client.jembi.org"
						name: "TEST Application"
						roles:
							[ 
								"OpenMRS_PoC"
								"PoC" 
							]
						passwordHash: ""
						cert:
							"""-----BEGIN CERTIFICATE-----
MIIEFTCCAv2gAwIBAgIJALAiF9OxCN0tMA0GCSqGSIb3DQEBBQUAMIGgMQswCQYD
VQQGEwJaQTEMMAoGA1UECAwDS1pOMQ8wDQYDVQQHDAZEdXJiYW4xITAfBgNVBAoM
GEplbWJpIEhlYWx0aCBTeXN0ZW1zIE5QQzEQMA4GA1UECwwHZUhlYWx0aDEeMBwG
A1UEAwwVdGVzdC1jbGllbnQuamVtYmkub3JnMR0wGwYJKoZIhvcNAQkBFg5yeWFu
QGplbWJpLm9yZzAeFw0xNDAzMTkxMzQ2NDhaFw0yNDAzMTYxMzQ2NDhaMIGgMQsw
CQYDVQQGEwJaQTEMMAoGA1UECAwDS1pOMQ8wDQYDVQQHDAZEdXJiYW4xITAfBgNV
BAoMGEplbWJpIEhlYWx0aCBTeXN0ZW1zIE5QQzEQMA4GA1UECwwHZUhlYWx0aDEe
MBwGA1UEAwwVdGVzdC1jbGllbnQuamVtYmkub3JnMR0wGwYJKoZIhvcNAQkBFg5y
eWFuQGplbWJpLm9yZzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAKPB
9eSU9vASw7a+Dk79T92PpkdWcOy7Tt4AQXoepKJRy/ip3QKxPHLekSqRRQ12maZo
7axsctB5EoI3bGpD/a/GukaS5BE5rt5g74G6iAC24RygeOv7H86U03l06XrTyRgk
2DGw5LZVajjaFX9630eoBnoTPxLHmNHCV94I4c1cEMZrcS6kNXH/4jtuLJGjWy9p
p9A0D7Lf/egoMmQqBQ1RVc4f43OiCyhrCVMMb2WuDPctiXZrlXopB0OPLpQOv3WO
EzeKhA88BLSH7+Iyj6BUPazCfVaKyfrqa6iSUiXYj8lJFBhN49Pd5oPHLb6YR2Ci
bYZcgDhGmYryruofXBcCAwEAAaNQME4wHQYDVR0OBBYEFPmmVNZYuv2Ha3m1bRtk
xfdkuCaMMB8GA1UdIwQYMBaAFPmmVNZYuv2Ha3m1bRtkxfdkuCaMMAwGA1UdEwQF
MAMBAf8wDQYJKoZIhvcNAQEFBQADggEBAGqyp9cvxRtrzga0Z6+hY72Vk7nsQ5FP
F7WZ7mT8FFbM4BhZb8lIdVx/BzA4tEpFuTrRqM1k5Rp9Nn90/4mz7XLacb6usq12
MOv5TKCzt+rmvoQv/lgdIYU1167meHIUZMgRLSrd3/sT1+NgSisIrFROiRFNt2Th
6+KOPVkU8zpbEX5pGoiIaunBcKnEyae/iqFJTKzHK9KSZAH7roJPnuc/m1ZuPyM1
3s5k50m/dG1mBG8igRmtEWVIA14Qh1vWT2HMb1QtR4uiFHt6CSm7K4jfpDukLa+s
VgFoA+CfqiFgWdK5xSJq89GA4xSBFUppMqcpNDNUgSfGt/U8TY/mfGE=
-----END CERTIFICATE-----"""

					applications.addApplication testAppDoc, (error, newAppDoc) ->
						mockServer = testUtils.createMockServer 201, "Mock response body\n", 1232, ->
							done()

			after (done) ->
				router.removeChannel "TEST DATA - Mock endpoint", ->
					applications.removeApplication "testApp", ->
						mockServer.close ->
							done()

			it.skip "should forward a request to the configured routes if the application is authenticated and authorised", (done) ->
				server.start 5001, 5000, ->
					options =
						host: "localhost"
						path: "test/mock"
						port: 5000
						cert: fs.readFileSync "test/client-tls/cert.pem"
						key:  fs.readFileSync "test/client-tls/key.pem"

					https.request options, (req, res) ->
						res.statusCode.should.be 201
						server.stop (err) ->
							if err
								done err
							else
								done()

		describe "Basic Authentication", ->

			mockServer = null

			before (done) ->
				config.authentication.enableMutualTLSAuthentication = false
				config.authentication.enableBasicAuthentication = true

				#Setup some test data
				channel1 =
					name: "TEST DATA - Mock endpoint"
					urlPattern: "test/mock"
					allow: [ "PoC" ]
					routes: [
								host: "localhost"
								port: 1232
								primary: true
							]
				router.addChannel channel1, (err) ->
					testAppDoc =
						applicationID: "testApp"
						domain: "openhim.jembi.org"
						name: "TEST Application"
						roles:
							[ 
								"OpenMRS_PoC"
								"PoC" 
							]
						passwordHash: "password"
						cert: ""					

					applications.addApplication testAppDoc, (error, newAppDoc) ->
						mockServer = testUtils.createMockServer 200, "Mock response body 1\n", 1232, ->
							done()

			after (done) ->
				router.removeChannel "TEST DATA - Mock endpoint", ->
					applications.removeApplication "testApp", ->
						mockServer.close ->
							done()

			describe "with no credentials", ->
				it "should `throw` 401", (done) ->
					server.start 5001, null, ->
						request("http://localhost:5001")
							.get("/test/mock")
							.expect(401)
							.end (err, res) ->
								server.stop ->
									if err
										done err
									else
										done()

			describe "with incorrect credentials", ->
				it "should `throw` 401", (done) ->
					server.start 5001, null, ->
						request("http://localhost:5001")
							.get("/test/mock")
							.auth("incorrect_user", "incorrect_password")
							.expect(401)
							.end (err, res) ->
								server.stop ->
									if err
										done err
									else
										done()
			
			describe "with correct credentials", ->
				it "should return 200 OK", (done) ->
					server.start 5001, null, ->
						request("http://localhost:5001")
							.get("/test/mock")
							.auth("testApp", "password")
							.expect(200)
							.end (err, res) ->
								server.stop ->
									if err
										done err
									else
										done()
							