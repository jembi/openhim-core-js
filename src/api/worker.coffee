TasksModel = require('../model/tasks').Task
tasks = require './tasks'
Q = require("q")
logger = require("winston")
monq = require("monq")
config = require("../config/config")
client = monq(config.mongo.url)

worker = client.worker([ "transactions" ])
worker.register process_transactions: (params, callback) ->
  try

    transactionID = params.transactionID;
    taskID = params.taskID;

    

    ###
    TasksModel.findById taskID, (err, result) -> 
      console.log "TEST:" + result

      TasksModel.update , (err, result) -> 

      callback null, transactionID
    ###

  catch err
    callback err

console.log "INFO: Starting the workers"

worker.start()