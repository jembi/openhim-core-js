should = require 'should'
request = require 'supertest'
_ = require 'lodash'
server = require '../../lib/server'
testUtils = require '../testUtils'
Visualizer = require('../../lib/model/visualizer').Visualizer
auth = require('../testUtils').auth

describe 'API Integration Tests', ->
  describe 'Visualizers REST API testing', ->

    visObj =
      name: 'TestVisualizer'
      components: [
          eventType: 'primary'
          eventName: 'OpenHIM Mediator FHIR Proxy Route'
          display: 'FHIR Server'
        ,
          eventType: 'primary'
          eventName: 'echo'
          display: 'Echo'
      ]
      color:
        inactive: '#c8cacf'
        active: '#10e057'
        error: '#a84b5c'
        text: '#4a4254'
      size:
        responsive: true
        width: 1000
        height: 400
        paddin: 20
      time:
        updatePeriod: 200
        maxSpeed: 5
        maxTimeout: 5000
        minDisplayPeriod: 500
      channels: [
          eventType: 'channel'
          eventName: 'FHIR Proxy'
          display: 'FHIR Proxy'
        ,
          eventType: 'channel'
          eventName: 'Echo'
          display: 'Echo'
      ]
      mediators: [
          mediator: 'urn:mediator:fhir-proxy'
          name: 'OpenHIM Mediator FHIR Proxy'
          display: 'OpenHIM Mediator FHIR Proxy'
        ,
          mediator: 'urn:mediator:shell-script'
          name: 'OpenHIM Shell Script Mediator'
          display: 'OpenHIM Shell Script Mediator'
      ]

    authDetails = {}

    before (done) ->
      Visualizer.remove {}, ->
        auth.setupTestUsers () ->
          server.start apiPort: 8080, ->
            done()

    after (done) ->
      server.stop ->
        auth.cleanupTestUsers ->
          done()

    beforeEach ->
      authDetails = auth.getAuthDetails()

    afterEach (done) ->
      Visualizer.remove {}, ->
        done()

    describe '*getVisualizers()', ->

      it 'should return a 200 response with a list of saved visualizers', (done) ->
        vis1 = _.assign {}, visObj
        vis1.name = 'Visualizer1'
        vis1 = new Visualizer vis1
        vis2 = _.assign {}, visObj
        vis2.name = 'Visualizer2'
        vis2 = new Visualizer vis2

        vis1.save (err) ->
          return done err if err
          vis2.save (err) ->
            return done err if err

            request 'https://localhost:8080'
              .get '/visualizers'
              .set('auth-username', testUtils.rootUser.email)
              .set('auth-ts', authDetails.authTS)
              .set('auth-salt', authDetails.authSalt)
              .set('auth-token', authDetails.authToken)
              .expect(200)
              .end (err, res) ->
                return done err if err
                
                res.body.should.be.an.Array()
                res.body.length.should.be.exactly 2
                names = res.body.map (vis) -> vis.name
                ('Visualizer1' in names).should.be.true()
                ('Visualizer2' in names).should.be.true()
                done()

      it 'should return a 403 response if the user is not an admin', (done) ->
        request 'https://localhost:8080'
          .get '/visualizers'
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
          .end (err, res) ->
            return done err if err
            done()

      it 'should return an empty array if there are no visualizers', (done) ->
        request 'https://localhost:8080'
          .get '/visualizers'
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)
          .end (err, res) ->
            return done err if err
            
            res.body.should.be.an.Array()
            res.body.length.should.be.exactly 0
            done()


    describe '*getVisualizer(visualizerId)', ->

      it 'should return a 200 response with a specific visualizer', (done) ->
        vis1 = _.assign {}, visObj
        vis1.name = 'Visualizer1'
        vis1 = new Visualizer vis1
        vis2 = _.assign {}, visObj
        vis2.name = 'Visualizer2'
        vis2 = new Visualizer vis2

        vis1.save (err) ->
          return done err if err
          vis2.save (err) ->
            return done err if err

            request 'https://localhost:8080'
              .get '/visualizers/' + vis1._id
              .set('auth-username', testUtils.rootUser.email)
              .set('auth-ts', authDetails.authTS)
              .set('auth-salt', authDetails.authSalt)
              .set('auth-token', authDetails.authToken)
              .expect(200)
              .end (err, res) ->
                return done err if err
                
                res.body.should.be.an.Object()
                res.body.should.have.property("name", "Visualizer1")
                done()

      it 'should return a 403 response if the user is not an admin', (done) ->
        request 'https://localhost:8080'
          .get '/visualizers/111111111111111111111111'
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
          .end (err, res) ->
            return done err if err
            done()

      it 'should return 404 with message if no visualizers match the _id', (done) ->
        request 'https://localhost:8080'
          .get '/visualizers/111111111111111111111111'
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(404)
          .end (err, res) ->
            return done err if err
            
            res.text.should.equal "Visualizer with _id 111111111111111111111111 could not be found."
            done()


    describe '*addVisualizer()', ->

      it 'should add a visualizer and return a 201 response', (done) ->
        request 'https://localhost:8080'
          .post '/visualizers'
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(_.assign {}, visObj)
          .expect(201)
          .end (err, res) ->
            return done err if err
            
            Visualizer.findOne { name: "Visualizer1" }, (err, vis) ->
              return done err if err
              done()

      it 'should return a 403 response if the user is not an admin', (done) ->
        request 'https://localhost:8080'
          .post '/visualizers'
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(_.assign {}, visObj)
          .expect(403)
          .end (err, res) ->
            return done err if err
            done()

      it 'should return 404 if no request object is sent', (done) ->
        request 'https://localhost:8080'
          .post '/visualizers'
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send()
          .expect(404)
          .end (err, res) ->
            return done err if err
            
            res.text.should.equal "Cannot Add Visualizer, no request object"
            done()


    describe '*updateVisualizer(visualizerId)', ->

      it 'should update a specific visualizer and return a 200 response', (done) ->
        vis1 = _.assign {}, visObj
        vis1.name = 'Visualizer1'
        vis1 = new Visualizer vis1
        
        visUpdate = _.assign {}, visObj
        visUpdate.name = 'VisualizerUpdate1'
        visUpdate.color.inactive = '#11111'
        
        vis1.save (err) ->
          return done err if err

          request 'https://localhost:8080'
            .put '/visualizers/' + vis1._id
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(visUpdate)
            .expect(200)
            .end (err, res) ->
              return done err if err
              
              Visualizer.findOne { name: "VisualizerUpdate1" }, (err, vis) ->
                return done err if err
                vis.color.should.have.property "inactive", "#11111"
                done()

      it 'should return a 403 response if the user is not an admin', (done) ->
        request 'https://localhost:8080'
          .put '/visualizers/111111111111111111111111'
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(_.assign {}, visObj)
          .expect(403)
          .end (err, res) ->
            return done err if err
            done()

      it 'should return 404 if no request object is sent', (done) ->
        request 'https://localhost:8080'
          .put '/visualizers/111111111111111111111111'
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send()
          .expect(404)
          .end (err, res) ->
            return done err if err
            
            res.text.should.equal "Cannot Update Visualizer with _id 111111111111111111111111, no request object"
            done()

      it 'should return 404 if no visualizers match the _id', (done) ->
        request 'https://localhost:8080'
          .put '/visualizers/111111111111111111111111'
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(_.assign {}, visObj)
          .expect(404)
          .end (err, res) ->
            return done err if err
            
            res.text.should.equal "Cannot Update Visualizer with _id 111111111111111111111111, does not exist"
            done()
  
  
    describe '*removeVisualizer(visualizerId)', ->

      it 'should sucessfully remove a visualizer', (done) ->
        vis1 = _.assign {}, visObj
        vis1.name = 'Root\'s Visualizer 1'
        vis1 = new Visualizer vis1
        vis2 = _.assign {}, visObj
        vis2.name = 'Root\'s Visualizer 2'
        vis2 = new Visualizer vis2

        vis1.save (err) ->
          return done err if err
          vis2.save (err) ->
            return done err if err

            request 'https://localhost:8080'
              .del '/visualizers/' + vis1._id
              .set('auth-username', testUtils.rootUser.email)
              .set('auth-ts', authDetails.authTS)
              .set('auth-salt', authDetails.authSalt)
              .set('auth-token', authDetails.authToken)
              .expect(200)
              .end (err, res) ->
                return done err if err
                
                Visualizer.find (err, visualizers) ->
                  visualizers.length.should.be.exactly 1
                  done()

      it 'should return a 403 response if the user is not an admin', (done) ->
        request 'https://localhost:8080'
          .delete '/visualizers/111111111111111111111111'
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
          .end (err, res) ->
            return done err if err
            done()

      it 'should return a 404 when the visualizer doesn\'t exist', (done) ->
        request 'https://localhost:8080'
          .delete '/visualizers/111111111111111111111111'
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(404)
          .end (err, res) ->
            return done err if err
            done()
