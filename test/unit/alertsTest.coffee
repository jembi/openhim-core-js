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
	channelID: "test"
	request:
		timestamp: new Date ''
	response:
		status: 404

testTransaction2 = new Transaction
	clientID: "testClient"
	channelID: "test"
	request:
		timestamp: new Date ''
	response:
		status: 200
	routes: [response: status: 404 ]

testTransaction3 = new Transaction
	clientID: "testClient"
	channelID: "test"
	request:
		timestamp: new Date ''
	response:
		status: 500

testTransaction4 = new Transaction
	clientID: "testClient"
	channelID: "test"
	request:
		timestamp: new Date ''
	response:
		status: 500

describe "Transaction Alerts", ->
	before (done) ->
		testUser1.save -> testUser2.save -> testGroup1.save -> testGroup2.save -> testChannel.save -> done()

	after (done) ->
		User.remove {}, -> ContactGroup.remove {}, -> Channel.remove {}, -> done()

	afterEach (done) ->
		Transaction.remove {}, -> done()

	describe ".findTransactionsMatchingStatus", ->
		it "should do stuff!", (done) ->
			done()
