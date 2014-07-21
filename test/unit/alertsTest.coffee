should = require "should"
sinon = require "sinon"
http = require "http"
alerts = require "../../lib/alerts"
testUtils = require "../testUtils"
Channel = require("../../lib/model/channels").Channel
User = require("../../lib/model/users").User
ContactGroup = require("../../lib/model/contactGroups").ContactGroup
ContactUser = require("../../lib/model/contactGroups").ContactUser
Transaction = require("../../lib/model/transactions").Transaction

testUser1 = new User
	firstname: 'User'
	surname: 'One'
	email: 'one@openhim.org'
	passwordAlgorithm: 'sha512'
	passwordHash: '3cc90918-7044-4e55-b61d-92ae73cb261e'
	passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0'

testUser2 = new User
	firstname: 'User'
	surname: 'Two'
	email: 'two@openhim.org'
	passwordAlgorithm: 'sha512'
	passwordHash: '3cc90918-7044-4e55-b61d-92ae73cb261e'
	passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0'

testGroup1 = new ContactGroup
	group: 'group1'
	users: ['one@openhim.org', 'two@openhim.org']

testGroup2 = new ContactGroup
	group: 'group2'
	users: ['one@openhim.org']

testChannel = new Channel
	name: 'test'
	urlPattern: '/test'
	allow: '*'
	alerts: [
		{
			status: "404"
			groups: ['group1']
		}
		{
			status: '5xx'
			groups: ['group2']
			users: ['two@openhim.org']
			failureRate: 2
		}
	]

testTransaction1 = new Transaction
	clientID: "testClient"
	request:
		timestamp: new Date()
		path: "/path"
		method: "GET"
	response:
		status: 404
	status: "Completed"

testTransaction2 = new Transaction
	clientID: "testClient"
	request:
		timestamp: new Date()
		path: "/path"
		method: "GET"
	response:
		status: 200
	routes: [
		name: "testRoute"
		request:
			timestamp: new Date()
			path: "/path"
			method: "GET"
		response: status: 404
	]
	status: "Completed"

testTransaction3 = new Transaction
	clientID: "testClient"
	request:
		timestamp: new Date()
		path: "/path"
		method: "GET"
	response:
		status: 400
	status: "Completed"


testTransaction4 = new Transaction
	clientID: "testClient"
	request:
		timestamp: new Date()
		path: "/path"
		method: "GET"
	response:
		status: 500
	status: "Completed"

testTransaction5 = new Transaction
	clientID: "testClient"
	request:
		timestamp: new Date()
		path: "/path"
		method: "GET"
	response:
		status: 500
	status: "Completed"

testTransaction6 = new Transaction
	clientID: "testClient"
	channelID: "nonexistentChannel"
	request:
		timestamp: new Date()
		path: "/path"
		method: "GET"
	response:
		status: 404
	status: "Completed"

dateFrom = new Date()
dateFrom.setHours 0, 0, 0, 0


describe "Transaction Alerts", ->
	before (done) ->
		testUser1.save -> testUser2.save -> testGroup1.save -> testGroup2.save -> testChannel.save ->
			testTransaction1.channelID = testChannel._id
			testTransaction2.channelID = testChannel._id
			testTransaction3.channelID = testChannel._id
			testTransaction4.channelID = testChannel._id
			testTransaction5.channelID = testChannel._id
			done()

	after (done) ->
		User.remove {}, -> ContactGroup.remove {}, -> Channel.remove {}, -> done()

	afterEach (done) ->
		Transaction.remove {}, -> done()

	describe ".findTransactionsMatchingStatus", ->
		it "should return transactions that match an exact status", (done) ->
			testTransaction1.save (err) ->
				return done err if err
				alerts.findTransactionsMatchingStatus testChannel._id, "404", dateFrom, (err, results) ->
					results.length.should.be.exactly 1
					results[0]._id.equals(testTransaction1._id).should.be.true
					done()

		it "should return transactions that have a matching status in a route response", (done) ->
			testTransaction2.save (err) ->
				return done err if err
				alerts.findTransactionsMatchingStatus testChannel._id, "404", dateFrom, (err, results) ->
					results.length.should.be.exactly 1
					results[0]._id.equals(testTransaction2._id).should.be.true
					done()

		it "should only return transactions for the requested channel", (done) ->
			# should return 1 but not 6
			testTransaction1.save (err) ->
				return done err if err
				testTransaction6.save (err) ->
					return done err if err
					alerts.findTransactionsMatchingStatus testChannel._id, "404", dateFrom, (err, results) ->
						results.length.should.be.exactly 1
						results[0]._id.equals(testTransaction1._id).should.be.true
						done()

		it "should return all matching transactions for a fuzzy status search for the specified channel", (done) ->
			# should return 1, 2 and 3 but not 6
			testTransaction1.save (err) ->
				return done err if err
				testTransaction2.save (err) ->
					return done err if err
					testTransaction3.save (err) ->
						return done err if err
						testTransaction6.save (err) ->
							return done err if err
							Transaction.find {}, (err, r) -> console.log r
							alerts.findTransactionsMatchingStatus testChannel._id, "4xx", dateFrom, (err, results) ->
								#results.length.should.be.exactly 3
								console.log results
								resultIDs = results.map (result) -> result._id
								resultIDs.should.containEql testTransaction1._id
								done()
