TasksModel = require('../model/tasks').Task
tasks = require './tasks'
Q = require("q")
logger = require("winston")
monq = require("monq")
config = require("../config/config")
client = monq(config.mongo.url)



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

          ###
          #In here we need to do the actual transaction rerun script
          ###
          #Remove Queue item






          #retrieve the transaction to rerun
          Transaction.findOne _id: transactionID, (err, transaction) ->
            #console.log(transaction)

            # construct the 'ctx' object to create a new transaction record with no response message
            ctx = new Object()
            ctx.path = transaction.request.path
            ctx.header = transaction.request.headers
            
            ctx.querystring = transaction.request.querystring
            ctx.body = transaction.request.body
            ctx.method = transaction.request.method

            ctx.request = new Object()
            ctx.request.url = transaction.request.path
            ctx.request.method = transaction.request.method
            ctx.request.querystring = transaction.request.querystring

            ctx.response = new Object()
            ctx.status = "Processing"

            #store the message without a response (before HTTP request is made)
            messageStore.storeTransaction ctx, (error, saveTransaction) ->               
              console.log(saveTransaction)




              ###
              # An HTTP request needs to made here and the response captured
              ###





              # The response received from the HTTP request needs to be updated in the transaction
              messageStore.storeTransaction ctx, (error, updateTransaction) ->               
                console.log(updateTransaction)  












              ###
              # This is code we had originally for the router call and the transaction update save
              Client.findOne clientID: transaction.clientID, (err, client) ->
                #console.log(client)

                ctx.authenticated = new Object()
                ctx.authenticated = client

                Q.denodeify ->
                  Authorisation.authorise ctx, (error, authorise) -> 
                    console.log(authorise);
                    
                    Router.route ctx, (error, router) ->

                      console.log(router);

                      
                      messageStore.storeTransaction ctx, (error, updateMessage) ->
                      
                        console.log(updateMessage);  
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
      #console.log  "Task Status: " + record.status
      #console.log "Result: " + record



      callback null, transactionID


  catch err
    callback err

console.log "info: Starting the workers"

worker.start()