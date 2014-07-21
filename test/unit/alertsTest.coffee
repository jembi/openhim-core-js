should = require "should"
sinon = require "sinon"
http = require "http"
moment = require "moment"
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

testFailureRate = 2

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
			failureRate: testFailureRate
		}
	]

testTransactions = [
	# 0
	new Transaction
		clientID: "testClient"
		request:
			timestamp: new Date()
			path: "/path"
			method: "GET"
		response:
			status: 404
		status: "Completed"

	# 1
	new Transaction
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

	# 2
	new Transaction
		clientID: "testClient"
		request:
			timestamp: new Date()
			path: "/path"
			method: "GET"
		response:
			status: 400
		status: "Completed"

	# 3
	new Transaction
		clientID: "testClient"
		request:
			timestamp: new Date()
			path: "/path"
			method: "GET"
		response:
			status: 500
		status: "Completed"

	# 4
	new Transaction
		clientID: "testClient"
		request:
			timestamp: new Date()
			path: "/path"
			method: "GET"
		response:
			status: 500
		status: "Completed"

	# 5
	new Transaction
		clientID: "testClient"
		request:
			timestamp: new Date()
			path: "/path"
			method: "GET"
		response:
			status: 500
		status: "Completed"

	# 6
	new Transaction
		clientID: "testClient"
		request:
			timestamp: new Date()
			path: "/path"
			method: "GET"
		response:
			status: 404
		status: "Completed"
]

dateFrom = new Date()
dateFrom.setHours 0, 0, 0, 0


describe "Transaction Alerts", ->
	before (done) ->
		testUser1.save -> testUser2.save -> testGroup1.save -> testGroup2.save -> testChannel.save ->
			for testTransaction in testTransactions
				testTransaction.channelID = testChannel._id
			testTransactions[6].channelID = "nonexistentChannel"
			done()

	after (done) ->
		User.remove {}, -> ContactGroup.remove {}, -> Channel.remove {}, -> done()

	afterEach (done) ->
		Transaction.remove {}, ->
			for testTransaction in testTransactions
				testTransaction.isNew = true
				delete testTransaction._id
			done()

	describe ".findTransactionsMatchingStatus", ->
		it "should return transactions that match an exact status", (done) ->
			testTransactions[0].save (err) ->
				return done err if err
				alerts.findTransactionsMatchingStatus testChannel._id, "404", dateFrom, null, (err, results) ->
					results.length.should.be.exactly 1
					results[0]._id.equals(testTransactions[0]._id).should.be.true
					done()

		it "should return transactions that have a matching status in a route response", (done) ->
			testTransactions[1].save (err) ->
				return done err if err
				alerts.findTransactionsMatchingStatus testChannel._id, "404", dateFrom, null, (err, results) ->
					results.length.should.be.exactly 1
					results[0]._id.equals(testTransactions[1]._id).should.be.true
					done()

		it "should only return transactions for the requested channel", (done) ->
			# should return transaction 0 but not 6
			testTransactions[0].save (err) ->
				return done err if err
				testTransactions[6].save (err) ->
					return done err if err
					alerts.findTransactionsMatchingStatus testChannel._id, "404", dateFrom, null, (err, results) ->
						results.length.should.be.exactly 1
						results[0]._id.equals(testTransactions[0]._id).should.be.true
						done()

		it "should not return transactions that occur before dateFrom", (done) ->
			testTransactions[0].save (err) ->
				return done err if err
				newFrom = moment().add('days', 1).toDate()
				alerts.findTransactionsMatchingStatus testChannel._id, "404", newFrom, null, (err, results) ->
					results.length.should.be.exactly 0
					done()

		it "should return all matching transactions for a fuzzy status search for the specified channel", (done) ->
			# should return transactions 0, 1 and 2 but not 3 or 6
			testTransactions[0].save (err) ->
				return done err if err
				testTransactions[1].save (err) ->
					return done err if err
					testTransactions[2].save (err) ->
						return done err if err
						testTransactions[3].save (err) ->
							return done err if err
							testTransactions[6].save (err) ->
								return done err if err
								alerts.findTransactionsMatchingStatus testChannel._id, "4xx", dateFrom, null, (err, results) ->
									console.log err
									results.length.should.be.exactly 3
									resultIDs = results.map (result) -> result._id
									resultIDs.should.containEql testTransactions[0]._id
									resultIDs.should.containEql testTransactions[1]._id
									resultIDs.should.containEql testTransactions[2]._id
									resultIDs.should.not.containEql testTransactions[6]._id
									done()

		it "should not return any transactions when their count is below the failure rate", (done) ->
			testTransactions[3].save (err) ->
				return done err if err
				alerts.findTransactionsMatchingStatus testChannel._id, "500", dateFrom, testFailureRate, (err, results) ->
					# only one 500 transaction, but failureRate is 2
					results.length.should.be.exactly 0
					done()

		it "should return transactions when their count is equal to the failure rate", (done) ->
			testTransactions[3].save (err) ->
				return done err if err
				testTransactions[4].save (err) ->
					return done err if err
					alerts.findTransactionsMatchingStatus testChannel._id, "500", dateFrom, testFailureRate, (err, results) ->
						results.length.should.be.exactly 2
						resultIDs = results.map (result) -> result._id
						resultIDs.should.containEql testTransactions[3]._id
						resultIDs.should.containEql testTransactions[4]._id
						done()

		it "should return transactions when their count is above the failure rate", (done) ->
			testTransactions[3].save (err) ->
				return done err if err
				testTransactions[4].save (err) ->
					return done err if err
					testTransactions[5].save (err) ->
						return done err if err
						alerts.findTransactionsMatchingStatus testChannel._id, "500", dateFrom, testFailureRate, (err, results) ->
							results.length.should.be.exactly 3
							resultIDs = results.map (result) -> result._id
							resultIDs.should.containEql testTransactions[3]._id
							resultIDs.should.containEql testTransactions[4]._id
							resultIDs.should.containEql testTransactions[5]._id
							done()
