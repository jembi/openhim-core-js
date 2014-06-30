TasksModel = require('../model/tasks').Task
tasks = require './tasks'
Q = require("q")
logger = require("winston")
monq = require("monq")
config = require("../config/config")
client = monq(config.mongo.url)



messageStore = require "../middleware/messageStore"
Transaction = require("../model/transactions").Transaction
router = require "../middleware/router"



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

          ###
          #In here we need to do the actual transaction rerun script
          ###
          #Remove Queue item




          


          Transaction.findOne
            _id: transactionID
          , (err, transaction) ->
            console.log(transaction)


          ###
          ctx = new Object()
          ctx.path = "/api/test/request"
          ctx.header =
            headerName: "headerValue"
            "Content-Type": "application/json"            
            "Content-Length": "9313219921"

          ctx.querystring = "param1=value1&param2=value2"
          ctx.body = "<HTTP body>"
          ctx.method = "POST"

          ctx.status = "Processing"
          ctx.authenticated = new Object()
          ctx.authenticated.clientID = "Master_OpenMRS_Instance"

          messageStore.storeTransaction ctx, (error, result) ->
            router.route ctx ->

              res = new Object()
              res.status = "200"
              res.headers =
                header: "value"
                header2: "value2"
              res.body = "<HTTP response>"
              res.timestamp = new Date()

              messageStore.storeTransaction ctx ->
            ###























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
      console.log  "Task Status: " + record.status
      #console.log "Result: " + record



      callback null, transactionID


  catch err
    callback err

console.log "info: Starting the workers"

worker.start()