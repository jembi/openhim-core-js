should = require "should"
sinon = require "sinon"
authorisation = require "../../lib/api/authorisation"
Channel = require("../../lib/model/channels").Channel
User = require("../../lib/model/users").User

describe "API authorisation test", ->

  user = new User
    firstname: 'Bill'
    surname: 'Murray'
    email: 'bfm@crazy.net'
    passwordAlgorithm: 'sha512'
    passwordHash: '3cc90918-7044-4e55-b61d-92ae73cb261e'
    passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0'
    groups: [ 'HISP' , 'group2' ]

  user2 = new User
    firstname: 'Random'
    surname: 'User'
    email: 'someguy@meh.net'
    passwordAlgorithm: 'sha512'
    passwordHash: '3cc90918-7044-4e55-b61d-92ae73cb261e'
    passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0'
    groups: [ 'nothing', 'here' ]

  user3 = new User
    firstname: 'Random'
    surname: 'User'
    email: 'someguy@meh.net'
    passwordAlgorithm: 'sha512'
    passwordHash: '3cc90918-7044-4e55-b61d-92ae73cb261e'
    passwordSalt: '22a61686-66f6-483c-a524-185aac251fb0'
    groups: [ 'admin' ]

  before (done) ->
    channel1 = new Channel
      name: "TestChannel1 - api authorisation"
      urlPattern: "test/sample"
      allow: [ "PoC", "Test1", "Test2" ]
      routes: [
            name: "test route"
            host: "localhost"
            port: 9876
            primary: true
          ]
      txViewAcl: [ "group1", "group2" ]
      txRerunAcl: [ "group2" ]

    channel2 = new Channel
      name: "TestChannel2 - api authorisation"
      urlPattern: "test/sample"
      allow: [ "PoC", "Test1", "Test2" ]
      routes: [
            name: "test route"
            host: "localhost"
            port: 9876
            primary: true
          ]
      txViewAcl: [ "group2", "group3" ]
      txRerunAcl: [ "group1", "group3" ]

    channel3 = new Channel
      name: "TestChannel3 - api authorisation"
      urlPattern: "test/sample"
      allow: [ "PoC", "Test1", "Test2" ]
      routes: [
            name: "test route"
            host: "localhost"
            port: 9876
            primary: true
          ]
      txViewAcl: [ "group4" ]
      txRerunAcl: [ "group4" ]

    channel1.save ->
      channel2.save ->
        channel3.save ->
          done()

  after (done) ->
    Channel.remove {}, ->
      done()

  describe ".inGroup", ->

    it "should return true when a user is in a particular group", ->
      result = authorisation.inGroup 'group2', user
      result.should.be.true

    it "should return falsse when a user is in NOT a particular group", ->
      result = authorisation.inGroup 'somethingelse', user
      result.should.be.false

  describe ".getUserViewableChannels", ->

    it "should return channels that a user can view", (done) ->
      promise = authorisation.getUserViewableChannels user
      promise.then (channels) ->
        try
          channels.should.have.length(2)
        catch err
          return done err
        done()
      , (err) ->
        done err

    it "should return an empty array when there are no channel that a user can view", (done) ->
      promise = authorisation.getUserViewableChannels user2
      promise.then (channels) ->
        try
          channels.should.have.length(0)
        catch err
          return done err
        done()
      , (err) ->
        done err

    it "should return all channels for viewing if a user is in the admin group", (done) ->
      promise = authorisation.getUserViewableChannels user3
      promise.then (channels) ->
        try
          channels.should.have.length(3)
        catch err
          return done err
        done()
      , (err) ->
        done err
      
  describe ".getUserRerunableChannels", ->

    it "should return channels that a user can rerun", (done) ->
      promise = authorisation.getUserRerunableChannels user
      promise.then (channels) ->
        try
          channels.should.have.length(1)
        catch err
          return done err
        done()
      , (err) ->
        done err

    it "should return an empty array when there are no channel that a user can rerun", (done) ->
      promise = authorisation.getUserRerunableChannels user2
      promise.then (channels) ->
        try
          channels.should.have.length(0)
        catch err
          return done err
        done()
      , (err) ->
        done err

    it "should return all channels for rerunning if a user is in the admin group", (done) ->
      promise = authorisation.getUserRerunableChannels user3
      promise.then (channels) ->
        try
          channels.should.have.length(3)
        catch err
          return done err
        done()
      , (err) ->
        done err
      
