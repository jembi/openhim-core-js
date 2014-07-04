TasksModel = require('../model/tasks').Task
tasks = require './tasks'
Q = require("q")
logger = require("winston")
monq = require("monq")
config = require("../config/config")
client = monq(config.mongo.url)


http = require 'http'
messageStore = require "../middleware/messageStore"
Transaction = require("../model/transactions").Transaction
Client = require("../model/clients").Client
Authorisation = require "../middleware/authorisation"
Router = require "../middleware/router"



worker = client.worker([ "transactions" ])
worker.register process_transactions: (params, callback) ->
  try

    transactionID = params.transactionID;
    taskID = params.taskID;

    # find the tasks object for the transaction being processed
    TasksModel.findOne
      _id: taskID
    , (err, record) ->
      
      #don't just ignore this, log or bubble forward via callbacks
      return  if err
      
      #TasksModel not found, log or send 404 or whatever
      return  unless record

      #set tasks object status to processing
      record.status = 'Processing'

      #foreach transaction object in the transaction property
      record.transactions.forEach (item) ->
        #check if transactionID matches the one in the transaction object
        if item.tid == transactionID






          #retrieve the transaction to rerun
          Transaction.findOne _id: transactionID, (err, transaction) ->
            #console.log(transaction)


            ################################################################
            # An HTTP request needs to made here and the response captured #
            ################################################################


            options =
              hostname: "localhost"
              port: 7786
              path: transaction.request.path
              method: transaction.request.method
              headers: transaction.request.headers
                clientID: transaction.clientID
                parentID: transaction._id

            console.log(options)

            if transaction.request.querystring
              options.path += "?"+transaction.request.querystring

            if transaction.request.body
              options.headers.body = transaction.request.body

            req = http.request(options, (res) ->
              res.setEncoding "utf8"
              res.on "data", (chunk) ->
                #data has been created
            )
            req.on "error", (e) ->
              console.log "problem with request: " + e.message

            # write data to request body

            if transaction.request.method == "POST" || transaction.request.method == "PUT"
              req.write transaction.request.body
            req.end()

            ################################################################
            # An HTTP request needs to made here and the response captured #
            ################################################################




          # update the status of the transaction that was processed
          item.tstatus = 'Completed'
          #increment the completed transactions amount
          record.completedTransactions++

          console.log "Successfully processed transaction " + record.completedTransactions + " of " + record.transactions.length + ". Transaction status == " + item.tstatus
  

      # set tasks status to 'Completed' if all transactions processed successfully
      if record.completedTransactions == record.transactions.length
        record.status = 'Completed'

      
      #inform Mongoose of changes made to the tasks object and save it
      record.markModified "transactions"
      record.save()      
      #console.log  "Task Status: " + record.status
      #console.log "Result: " + record



      callback null, transactionID


  catch err
    callback err

console.log "info: Starting the workers"

worker.start()
