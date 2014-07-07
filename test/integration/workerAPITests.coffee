should = require "should"
request = require "supertest"
server = require "../../lib/server"
Task = require("../../lib/model/tasks").Task
testUtils = require "../testUtils"
logger = require "winston"

config = require("../../lib/config/config")
MongoClient = require("mongodb").MongoClient

monq = require("monq")
client = monq(config.mongo.url)
queue = client.queue("transactions")

http = require 'http'

describe "Rerun Server Worker Tests", ->

	describe 'Worker transactions processing test', ->		

		task = new Task
			_id: "aaa908908bbb98cc1d0809ee"
			status: "NotStarted"
			transactions: [ {tid: "11111", tstatus: "Processing"},
							{tid: "22222", tstatus: "Processing"},
							{tid: "33333", tstatus: "Processing"} ]
			created: "2014-06-18T12:00:00.929Z"
			completed: "2014-06-18T12:01:00.929Z"
			completedTransactions: 0
			user: "root@openhim.org"

		
		
		before (done) ->
			task.save ->
				transactions = task.transactions
				taskID = task._id
				i = 0

				while i < transactions.length
				  try
				    transactionID = transactions[i].tid
				    queue.enqueue "process_transactions",
				      transactionID: transactionID
				      taskID: taskID
				    , (e, job) ->
				      logger.info "enqueued transaction:", job.data.params.transactionID

				    
				    # All ok! So set the result
				    @body = "info: Queue item successfully created"
				    @status = "created"
				  catch e
				    
				    # Error! So inform the user
				    logger.error "Could not add Queue item via the API: " + e
				    @body = e.message
				    @status = "bad request"
				  i++
				server.start null, null, 7786, ->
					done()

		after (done) ->
			server.stop ->
				Task.remove {}, ->
					MongoClient.connect config.mongo.url, (err, db) ->
					    mongoCollection = db?.collection "jobs"
					    mongoCollection.drop()
						done()


		describe '*Worker busy processing', ->

			it 'Should have 1 Task record with 3 transaction IDs', (done) ->
				MongoClient.connect config.mongo.url, (err, db) ->
					mongoCollectionTasks = db?.collection "tasks"
					tasks = mongoCollectionTasks.find {}
					tasks.toArray (err, results) ->
					    results.should.have.length 1
					    results[0].transactions.should.have.length 3
						done()

			it 'Should have 3 records in the jobs collection queue', (done) ->
				MongoClient.connect config.mongo.url, (err, db) ->
					mongoCollectionJobs = db?.collection "jobs"
					jobs = mongoCollectionJobs.find {}
					jobs.toArray (err, results) ->
						results.should.have.length 3
						done()

			it 'Should register the worker and process the queue items/update tasks status', (done) ->
				worker = client.worker([ "transactions" ])
				worker.register process_transactions: (params, callback) ->
					transactionID = params.transactionID;
					taskID = params.taskID;


					Task.findById taskID, (err, task) ->
						#set tasks object status to processing
						task.status = 'Processing'
						transactions = task.transactions
						i = 0

						while i < transactions.length
							if transactions[i].tid is transactionID

								#########################################
					            # An HTTP request needs to be made here #
					            #########################################

								# update the status of the transaction that was processed
								transactions[i].tstatus = 'Completed'
								
								#increment the completed transactions amount
								task.completedTransactions++

							i++

						# set tasks status to 'Completed' if all transactions processed successfully
						if task.completedTransactions == task.transactions.length
							task.status = 'Completed'

						task.markModified "task"
						task.save()
						
						if transactionID is "33333"
							task.should.have.property "status", "Completed"	
							done() 						

						callback null, transactionID						
					
				worker.start()			
					