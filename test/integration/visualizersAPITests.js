/* eslint-env mocha */

import request from 'supertest'
import * as server from '../../src/server'
import { VisualizerModelAPI } from '../../src/model/visualizer'
import * as testUtils from '../utils'
import * as constants from '../constants'
import { promisify } from 'util'

describe('API Integration Tests', () => {
  const { SERVER_PORTS } = constants

  describe('Visualizers REST API testing', () => {
    const visObj = {
      name: 'TestVisualizer',
      components: [{
        eventType: 'primary',
        eventName: 'OpenHIM Mediator FHIR Proxy Route',
        display: 'FHIR Server'
      },
      {
        eventType: 'primary',
        eventName: 'echo',
        display: 'Echo'
      }
      ],
      color: {
        inactive: '#c8cacf',
        active: '#10e057',
        error: '#a84b5c',
        text: '#4a4254'
      },
      size: {
        responsive: true,
        width: 1000,
        height: 400,
        paddin: 20
      },
      time: {
        updatePeriod: 200,
        maxSpeed: 5,
        maxTimeout: 5000,
        minDisplayPeriod: 500
      },
      channels: [{
        eventType: 'channel',
        eventName: 'FHIR Proxy',
        display: 'FHIR Proxy'
      },
      {
        eventType: 'channel',
        eventName: 'Echo',
        display: 'Echo'
      }
      ],
      mediators: [{
        mediator: 'urn:mediator:fhir-proxy',
        name: 'OpenHIM Mediator FHIR Proxy',
        display: 'OpenHIM Mediator FHIR Proxy'
      },
      {
        mediator: 'urn:mediator:shell-script',
        name: 'OpenHIM Shell Script Mediator',
        display: 'OpenHIM Shell Script Mediator'
      }
      ]
    }

    let authDetails = {}

    before(async () => {
      await Promise.all([
        VisualizerModelAPI.remove(),
        testUtils.setupTestUsers(),
        promisify(server.start)({ apiPort: SERVER_PORTS.apiPort })
      ])
    })

    after(async () => {
      await Promise.all([
        promisify(server.stop)(),
        testUtils.cleanupTestUsers()
      ])
    })

    beforeEach(() => { authDetails = testUtils.getAuthDetails() })

    afterEach(() => VisualizerModelAPI.remove())

    describe('*getVisualizers()', () => {
      it('should return a 200 response with a list of saved visualizers', async () => {
        let vis1 = Object.assign({}, visObj)
        vis1.name = 'Visualizer1'
        vis1 = new VisualizerModelAPI(vis1)

        let vis2 = Object.assign({}, visObj)
        vis2.name = 'Visualizer2'
        vis2 = new VisualizerModelAPI(vis2)

        await Promise.all([
          vis1.save(),
          vis2.save()
        ])

        const res = await request(constants.BASE_URL)
          .get('/visualizers')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.should.be.an.Array()
        res.body.length.should.be.exactly(2)
        const names = res.body.map(vis => vis.name);
        (Array.from(names).includes('Visualizer1')).should.be.true();
        (Array.from(names).includes('Visualizer2')).should.be.true()
      })

      it('should return a 403 response if the user is not an admin', async () => {
        await request(constants.BASE_URL)
          .get('/visualizers')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
      })

      it('should return an empty array if there are no visualizers', async () => {
        const res = await request(constants.BASE_URL)
          .get('/visualizers')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.should.be.an.Array()
        res.body.length.should.be.exactly(0)
      })
    })

    describe('*getVisualizer(visualizerId)', () => {
      it('should return a 200 response with a specific visualizer', async () => {
        let vis1 = Object.assign({}, visObj)
        vis1.name = 'Visualizer1'
        vis1 = new VisualizerModelAPI(vis1)

        let vis2 = Object.assign({}, visObj)
        vis2.name = 'Visualizer2'
        vis2 = new VisualizerModelAPI(vis2)

        await Promise.all([
          vis1.save(),
          vis2.save()
        ])

        const res = await request(constants.BASE_URL)
          .get(`/visualizers/${vis1._id}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)

        res.body.should.be.an.Object()
        res.body.should.have.property('name', 'Visualizer1')
      })

      it('should return a 403 response if the user is not an admin', async () => {
        await request(constants.BASE_URL)
          .get('/visualizers/111111111111111111111111')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
      })

      it('should return 404 with message if no visualizers match the _id', async () => {
        const res = await request(constants.BASE_URL)
          .get('/visualizers/111111111111111111111111')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(404)

        res.text.should.equal('Visualizer with _id 111111111111111111111111 could not be found.')
      })
    })

    describe('*addVisualizer()', () => {
      it('should add a visualizer and return a 201 response', async () => {
        await request(constants.BASE_URL)
          .post('/visualizers')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(Object.assign({}, visObj))
          .expect(201)

        await VisualizerModelAPI.findOne({ name: 'Visualizer1' })
      })

      it('should return a 403 response if the user is not an admin', async () => {
        await request(constants.BASE_URL)
          .post('/visualizers')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(Object.assign({}, visObj))
          .expect(403)
      })

      it('should return 404 if no request object is sent', async () => {
        const res = await request(constants.BASE_URL)
          .post('/visualizers')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send()
          .expect(404)

        res.text.should.equal('Cannot Add Visualizer, no request object')
      })
    })

    describe('*updateVisualizer(visualizerId)', () => {
      it('should update a specific visualizer and return a 200 response', async () => {
        let vis1 = Object.assign({}, visObj)
        vis1.name = 'Visualizer1'
        vis1 = new VisualizerModelAPI(vis1)

        const visUpdate = Object.assign({}, visObj)
        visUpdate.name = 'VisualizerUpdate1'
        visUpdate.color.inactive = '#11111'

        vis1.save()

        await request(constants.BASE_URL)
          .put(`/visualizers/${vis1._id}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(visUpdate)
          .expect(200)

        const vis = await VisualizerModelAPI.findOne({ name: 'VisualizerUpdate1' })
        vis.color.should.have.property('inactive', '#11111')
      })

      it('should return a 403 response if the user is not an admin', async () => {
        await request(constants.BASE_URL)
          .put('/visualizers/111111111111111111111111')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(Object.assign({}, visObj))
          .expect(403)
      })

      it('should return 404 if no request object is sent', async () => {
        const res = await request(constants.BASE_URL)
          .put('/visualizers/111111111111111111111111')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send()
          .expect(404)
        res.text.should.equal('Cannot Update Visualizer with _id 111111111111111111111111, no request object')
      })

      it('should return 404 if no visualizers match the _id', async () => {
        const res = await request(constants.BASE_URL)
          .put('/visualizers/111111111111111111111111')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(Object.assign({}, visObj))
          .expect(404)
        res.text.should.equal('Cannot Update Visualizer with _id 111111111111111111111111, does not exist')
      })
    })

    describe('*removeVisualizer(visualizerId)', () => {
      it('should sucessfully remove a visualizer', async () => {
        let vis1 = Object.assign({}, visObj)
        vis1.name = 'Root\'s Visualizer 1'
        vis1 = new VisualizerModelAPI(vis1)

        let vis2 = Object.assign({}, visObj)
        vis2.name = 'Root\'s Visualizer 2'
        vis2 = new VisualizerModelAPI(vis2)

        await Promise.all([
          vis1.save(),
          vis2.save()
        ])

        await request(constants.BASE_URL)
          .del(`/visualizers/${vis1._id}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)
        const visualizers = await VisualizerModelAPI.find()
        visualizers.length.should.be.exactly(1)
      })

      it('should return a 403 response if the user is not an admin', async () => {
        await request(constants.BASE_URL)
          .delete('/visualizers/111111111111111111111111')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
      })

      return it('should return a 404 when the visualizer doesn\'t exist', async () => {
        await request(constants.BASE_URL)
          .delete('/visualizers/111111111111111111111111')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(404)
      })
    })
  })
})
