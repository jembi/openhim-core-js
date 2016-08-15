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

    describe '*getAllVisualizers()', ->

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
                if err
                  done err
                else
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
            if err
              done err
            else
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
            if err
              done err
            else
              res.body.should.be.an.Array()
              res.body.length.should.be.exactly 0
              done()

    describe '*removeVisualizer(name)', ->

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
              .del '/visualizers/Root\'s Visualizer 1'
              .set('auth-username', testUtils.rootUser.email)
              .set('auth-ts', authDetails.authTS)
              .set('auth-salt', authDetails.authSalt)
              .set('auth-token', authDetails.authToken)
              .expect(200)
              .end (err, res) ->
                if err
                  done err
                else
                  Visualizer.find (err, visualizers) ->
                    visualizers.length.should.be.exactly 1
                    done()

      it 'should return a 403 response if the user is not an admin', (done) ->
        request 'https://localhost:8080'
          .delete '/visualizers/somename'
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
          .end (err, res) ->
            if err
              done err
            else
              done()

      it 'should return a 404 when the visualizer doesn\'t exist', (done) ->
        request 'https://localhost:8080'
          .delete '/visualizers/idontexist'
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(404)
          .end (err, res) ->
            if err
              done err
            else
              done()
