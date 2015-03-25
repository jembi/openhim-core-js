should = require "should"
request = require "supertest"
server = require "../../lib/server"
Task = require("../../lib/model/tasks").Task
Transaction = require("../../lib/model/transactions").Transaction
Channel = require("../../lib/model/channels").Channel
testUtils = require "../testUtils"
auth = require("../testUtils").auth

config = require("../../lib/config/config")
MongoClient = require("mongodb").MongoClient

describe "API Integration Tests", ->

  describe 'Tasks REST Api testing', ->

    task1 = new Task
      _id: "aaa908908bbb98cc1d0809ee"
      status: "Completed"
      remainingTransactions: 0
      totalTransactions: 4
      transactions: [ {tid: "11111", tstatus: "Completed"},
              {tid: "22222", tstatus: "Completed"},
              {tid: "33333", tstatus: "Failed"},
              {tid: "44444", tstatus: "Completed"} ]
      created: "2014-06-18T12:00:00.929Z"
      completed: "12014-06-18T12:01:00.929Z"
      user: "root@openhim.org"
    task2 = new Task
      _id: "aaa777777bbb66cc5d4444ee"
      status: "Queued"
      remainingTransactions: 3
      totalTransactions: 3
      transactions: [ {tid: "55555", tstatus: "Queued"},
              {tid: "66666", tstatus: "Queued"},
              {tid: "77777", tstatus: "Queued"} ]
      created: "2014-06-18T12:00:00.929Z"
      user: "root@openhim.org"

    task3 = new Task
      _id: "bbb777777bbb66cc5d4444ee"
      status: "Paused"
      remainingTransactions: 11
      totalTransactions: 23
      transactions: [ {tid: "11111", tstatus: "Completed", rerunID: "111111111111", rerunStatus: "Successful"},
              {tid: "22222", tstatus: "Completed", rerunID: "22222222222", rerunStatus: "Successful"},
              {tid: "33333", tstatus: "Completed", rerunID: "33333333333", rerunStatus: "Successful"},
              {tid: "fakeIDShouldFail", tstatus: "Failed", error: "Failed due to incorrect format of ID"},
              {tid: "55555", tstatus: "Completed", rerunID: "55555555555", rerunStatus: "Failed"},
              {tid: "66666", tstatus: "Completed", rerunID: "66666666666", rerunStatus: "Completed"},
              {tid: "77777", tstatus: "Completed", rerunID: "77777777777", rerunStatus: "Successful"},
              {tid: "88888", tstatus: "Completed", rerunID: "88888888888", rerunStatus: "Failed"},
              {tid: "fakeIDShouldFail2", tstatus: "Failed", error: "Failed due to incorrect format of ID"},
              {tid: "10101", tstatus: "Completed", rerunID: "10101010101", rerunStatus: "Failed"},
              {tid: "11011", tstatus: "Completed", rerunID: "11011011011", rerunStatus: "Failed"},
              {tid: "12121", tstatus: "Processing"},
              {tid: "13131", tstatus: "Queued"},
              {tid: "14141", tstatus: "Queued"},
              {tid: "15151", tstatus: "Queued"},
              {tid: "16161", tstatus: "Queued"},
              {tid: "17171", tstatus: "Queued"},
              {tid: "18181", tstatus: "Queued"},
              {tid: "19191", tstatus: "Queued"},
              {tid: "20202", tstatus: "Queued"},
              {tid: "21212", tstatus: "Queued"},
              {tid: "22022", tstatus: "Queued"},
              {tid: "23232", tstatus: "Queued"} ]
      created: "2014-06-18T12:00:00.929Z"
      user: "root@openhim.org"


    requ =
      path: "/api/test"
      headers:
        "header-title": "header1-value"
        "another-header": "another-header-value"
      querystring: "param1=value1&param2=value2"
      body: "<HTTP body request>"
      method: "POST"
      timestamp: "2014-06-09T11:17:25.929Z"

    transaction1 = new Transaction
      _id: "888888888888888888888888"
      status: "Successful"
      clientID: "000000000000000000000000"
      channelID: "aaaa11111111111111111111"
      request: requ

    transaction2 = new Transaction
      _id: "999999999999999999999999"
      status: "Successful"
      clientID: "000000000000000000000000"
      channelID: "aaaa11111111111111111111"
      request: requ

    transaction3 = new Transaction
      _id: "101010101010101010101010"
      status: "Successful"
      clientID: "000000000000000000000000"
      channelID: "aaaa11111111111111111111"
      request: requ

    transaction4 = new Transaction
      _id: "112233445566778899101122"
      status: "Successful"
      clientID: "000000000000000000000000"
      channelID: "bbbb22222222222222222222"
      request: requ

    transaction5 = new Transaction
      _id: "101010101010101010105555"
      status: "Successful"
      clientID: "000000000000000000000000"
      channelID: "cccc33333333333333333333"
      request: requ

    transaction6 = new Transaction
      _id: "101010101010101010106666"
      status: "Successful"
      clientID: "000000000000000000000000"
      channelID: "dddd44444444444444444444"
      request: requ


    channel = new Channel
      _id: "aaaa11111111111111111111"
      name: "TestChannel1"
      urlPattern: "test/sample"
      allow: [ "PoC", "Test1", "Test2" ]
      routes: [
            name: "test route"
            host: "localhost"
            port: 9876
            primary: true
          ]
      txViewAcl: [ "group1" ]
      txRerunAcl: [ "group2" ]

    channel2 = new Channel
      _id: "bbbb22222222222222222222"
      name: "TestChannel2"
      urlPattern: "test/sample2"
      allow: [ "PoC", "Test1", "Test2" ]
      routes: [
            name: "test route"
            host: "localhost"
            port: 9876
            primary: true
          ]
      txViewAcl: [ "group1" ]
      txRerunAcl: [ "group222222222" ]

    channel3 = new Channel
      _id: "cccc33333333333333333333"
      name: "TestChannel3"
      urlPattern: "test/sample3"
      allow: [ "PoC", "Test1", "Test2" ]
      routes: [
            name: "test route"
            host: "localhost"
            port: 9876
            primary: true
          ]
      txViewAcl: [ "group1" ]
      txRerunAcl: [ "group222222222" ]
      status: 'disabled'

    channel4 = new Channel
      _id: "dddd44444444444444444444"
      name: "TestChannel4"
      urlPattern: "test/sample4"
      allow: [ "PoC", "Test1", "Test2" ]
      routes: [
            name: "test route"
            host: "localhost"
            port: 9876
            primary: true
          ]
      txViewAcl: [ "group1" ]
      txRerunAcl: [ "group222222222" ]
      status: 'deleted'

    authDetails = {}

    before (done) ->
      task1.save ->
        task2.save ->
          task3.save (err) ->
            transaction1.save ->
              transaction2.save ->
                transaction3.save ->
                  transaction4.save ->
                    transaction5.save ->
                      transaction6.save ->
                        channel.save ->
                          channel2.save ->
                            channel3.save ->
                              channel4.save ->
                                auth.setupTestUsers ->
                                  server.start apiPort: 8080, ->
                                    done()

    after (done) ->
      server.stop ->
        auth.cleanupTestUsers ->
          Task.remove {}, ->
            Transaction.remove {}, ->
              Channel.remove {}, ->
                MongoClient.connect config.mongo.url, (err, db) ->
                  mongoCollection = db?.collection "jobs"
                  mongoCollection.drop()
                  done()

    beforeEach ->
      authDetails = auth.getAuthDetails()

    describe '*getTasks()', ->

      it 'should fetch all tasks', (done) ->

        obj =
          filterPage: 0
          filterLimit: 10
          filters: {}

        params = ""
        for k, v of obj
          v = JSON.stringify v
          if params.length > 0
              params += "&"
          params += "#{k}=#{v}"

        params = encodeURI params

        request("https://localhost:8080")
          .get("/tasks?"+params)
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              res.body.length.should.be.eql(3)
              done()

      it 'should fetch all tasks that are currently Paused', (done) ->

        obj =
          filterPage: 0
          filterLimit: 10
          filters: 
            status: 'Paused'

        params = ""
        for k, v of obj
          v = JSON.stringify v
          if params.length > 0
              params += "&"
          params += "#{k}=#{v}"

        params = encodeURI params

        request("https://localhost:8080")
          .get("/tasks?"+params)
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              res.body.length.should.be.eql(1)
              done()

    describe '*addTask()', ->

      it 'should add a new task', (done) ->
        newTask =
          tids: [ "888888888888888888888888", "999999999999999999999999", "101010101010101010101010" ]

        request("https://localhost:8080")
          .post("/tasks")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(newTask)
          .expect(201)
          .end (err, res) ->
            if err
              done err
            else
              Task.findOne { $and: [ transactions: { $elemMatch: { tid: "888888888888888888888888" } }, { transactions: $elemMatch: { tid: "999999999999999999999999" } }, { transactions: $elemMatch: { tid: "101010101010101010101010" } } ] }, (err, task) ->
                task.should.have.property "status", "Queued"
                task.transactions.should.have.length 3
                task.should.have.property "remainingTransactions", 3
                done()

      it 'should add a new task (non Admin user)', (done) ->
        newTask =
          tids: [ "888888888888888888888888", "999999999999999999999999", "101010101010101010101010" ]

        request("https://localhost:8080")
          .post("/tasks")
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(newTask)
          .expect(201)
          .end (err, res) ->
            if err
              done err
            else
              Task.findOne { $and: [ transactions: { $elemMatch: { tid: "888888888888888888888888" } }, { transactions: $elemMatch: { tid: "999999999999999999999999" } }, { transactions: $elemMatch: { tid: "101010101010101010101010" } } ] }, (err, task) ->
                task.should.have.property "status", "Queued"
                task.transactions.should.have.length 3
                task.should.have.property "remainingTransactions", 3
                done()



      it 'should NOT add a new task (non Admin user - No permission for one transaction)', (done) ->
        newTask =
          tids: [ "112233445566778899101122", "888888888888888888888888", "999999999999999999999999", "101010101010101010101010" ]

        request("https://localhost:8080")
          .post("/tasks")
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(newTask)
          .expect(403)
          .end (err, res) ->
            if err
              done err
            else
              done()

      it 'should NOT add a new task if there are transactions linked to disabled channels', (done) ->
        newTask =
          tids: [ "888888888888888888888888", "999999999999999999999999", "101010101010101010101010", "101010101010101010105555" ]

        request("https://localhost:8080")
          .post("/tasks")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(newTask)
          .expect(400)
          .end (err, res) ->
            if err
              done err
            else
              done()

      it 'should NOT add a new task if there are transactions linked to deleted channels (flagged)', (done) ->
        newTask =
          tids: [ "888888888888888888888888", "999999999999999999999999", "101010101010101010101010", "101010101010101010106666" ]

        request("https://localhost:8080")
          .post("/tasks")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(newTask)
          .expect(400)
          .end (err, res) ->
            if err
              done err
            else
              done()

      it 'should add a new task with status Paused if the request contains paused=true', (done) ->
        newTask =
          tids: [ "222288888888888888888888", "333399999999999999999999", "444410101010101010101010" ]
          paused: true

        request("https://localhost:8080")
          .post("/tasks")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(newTask)
          .expect(201)
          .end (err, res) ->
            if err
              done err
            else
              Task.findOne { $and: [ transactions: { $elemMatch: { tid: "222288888888888888888888" } }, { transactions: $elemMatch: { tid: "333399999999999999999999" } }, { transactions: $elemMatch: { tid: "444410101010101010101010" } } ] }, (err, task) ->
                task.should.have.property "status", "Paused"
                task.transactions.should.have.length 3
                task.should.have.property "remainingTransactions", 3
                done()

    describe '*getTask(taskId)', ->

      it 'should fetch a specific task by ID', (done) ->

        obj =
          filterPage: 0
          filterLimit: 10
          filters: {}

        params = ""
        for k, v of obj
          v = JSON.stringify v
          if params.length > 0
              params += "&"
          params += "#{k}=#{v}"

        params = encodeURI params

        request("https://localhost:8080")
          .get("/tasks/aaa908908bbb98cc1d0809ee?"+params)
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              res.body.should.have.property "_id", "aaa908908bbb98cc1d0809ee"
              res.body.should.have.property "status", "Completed"
              res.body.transactions.should.have.length 4
              done()

      it 'should fetch a specific task by ID with limit of first 10 records', (done) ->

        obj =
          filterPage: 0
          filterLimit: 10
          filters: {}

        params = ""
        for k, v of obj
          v = JSON.stringify v
          if params.length > 0
              params += "&"
          params += "#{k}=#{v}"

        params = encodeURI params

        request("https://localhost:8080")
          .get("/tasks/bbb777777bbb66cc5d4444ee?"+params)
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              res.body.should.have.property "_id", "bbb777777bbb66cc5d4444ee"
              res.body.should.have.property "status", "Paused"
              res.body.transactions.should.have.length 10
              
              res.body.transactions[0].should.have.property "rerunStatus", "Successful"
              res.body.transactions[2].should.have.property "rerunStatus", "Successful"
              res.body.transactions[3].should.have.property "error", "Failed due to incorrect format of ID"
              res.body.transactions[7].should.have.property "rerunStatus", "Failed"
              res.body.transactions[8].should.have.property "error", "Failed due to incorrect format of ID"
              res.body.transactions[9].should.have.property "rerunStatus", "Failed"
              done()

      it 'should fetch a specific task by ID with filters ( tstatus: "Completed" )', (done) ->

        obj =
          filterPage: 0
          filterLimit: 10
          filters: 
            tstatus: 'Completed'

        params = ""
        for k, v of obj
          v = JSON.stringify v
          if params.length > 0
              params += "&"
          params += "#{k}=#{v}"

        params = encodeURI params

        request("https://localhost:8080")
          .get("/tasks/bbb777777bbb66cc5d4444ee?"+params)
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              res.body.should.have.property "_id", "bbb777777bbb66cc5d4444ee"
              res.body.should.have.property "status", "Paused"
              res.body.transactions.should.have.length 9

              res.body.transactions[0].should.have.property "rerunStatus", "Successful"
              res.body.transactions[1].should.have.property "rerunStatus", "Successful"
              res.body.transactions[2].should.have.property "rerunStatus", "Successful"
              res.body.transactions[3].should.have.property "rerunStatus", "Failed"
              res.body.transactions[4].should.have.property "rerunStatus", "Completed"
              res.body.transactions[5].should.have.property "rerunStatus", "Successful"
              res.body.transactions[6].should.have.property "rerunStatus", "Failed"
              res.body.transactions[7].should.have.property "rerunStatus", "Failed"
              res.body.transactions[8].should.have.property "rerunStatus", "Failed"
              done()

      it 'should fetch a specific task by ID with filters ( tstatus: "Completed", rerunStatus: "Successful" )', (done) ->

        obj =
          filterPage: 0
          filterLimit: 10
          filters: 
            tstatus: 'Completed'
            rerunStatus: 'Successful'

        params = ""
        for k, v of obj
          v = JSON.stringify v
          if params.length > 0
              params += "&"
          params += "#{k}=#{v}"

        params = encodeURI params

        request("https://localhost:8080")
          .get("/tasks/bbb777777bbb66cc5d4444ee?"+params)
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              res.body.should.have.property "_id", "bbb777777bbb66cc5d4444ee"
              res.body.should.have.property "status", "Paused"
              res.body.transactions.should.have.length 4
              done()

    describe '*updateTask(taskId)', ->

      it 'should update a specific task by ID', (done) ->
        updates =
          status: "Completed"
          completed: "2014-06-18T13:30:00.929Z"

        request("https://localhost:8080")
          .put("/tasks/aaa777777bbb66cc5d4444ee")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(updates)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              Task.findOne { _id: "aaa777777bbb66cc5d4444ee" }, (err, task) ->
                task.should.have.property "status", "Completed"
                task.transactions.should.have.length 3
                done()

      it 'should not allow a non admin user to update a task', (done) ->
        updates = {}

        request("https://localhost:8080")
          .put("/tasks/890aaS0b93ccccc30dddddd0")
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .send(updates)
          .expect(403)
          .end (err, res) ->
            if err
              done err
            else
              done()

    describe '*removeTask(taskId)', ->

      it 'should remove a specific task by ID', (done) ->

        request("https://localhost:8080")
          .del("/tasks/aaa777777bbb66cc5d4444ee")
          .set("auth-username", testUtils.rootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(200)
          .end (err, res) ->
            if err
              done err
            else
              Task.find { _id: "aaa777777bbb66cc5d4444ee" }, (err, task) ->
                task.should.have.length 0
                done()

      it 'should not only allow a non admin user to remove a task', (done) ->

        request("https://localhost:8080")
          .del("/tasks/890aaS0b93ccccc30dddddd0")
          .set("auth-username", testUtils.nonRootUser.email)
          .set("auth-ts", authDetails.authTS)
          .set("auth-salt", authDetails.authSalt)
          .set("auth-token", authDetails.authToken)
          .expect(403)
          .end (err, res) ->
            if err
              done err
            else
              done()
