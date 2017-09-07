/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import sinon from 'sinon'
import request from 'supertest'
import { ChannelModelAPI } from '../../src/model/channels'
import * as server from '../../src/server'
import * as testUtils from '../testUtils'

const {auth} = testUtils

describe('API Integration Tests', () =>

  describe('Restart REST Api testing', () => {
    let authDetails = {}

    const channel = new ChannelModelAPI({
      name: 'TestChannel1',
      urlPattern: 'test/sample',
      allow: ['PoC', 'Test1', 'Test2'],
      routes: [{
        name: 'test route',
        host: 'localhost',
        port: 9876,
        primary: true
      }],
      txViewAcl: ['group1'],
      txViewFullAcl: []
    })

    before(done =>
      auth.setupTestUsers(err => {
        if (err) { return done(err) }
        channel.save(err => {
          if (err) { return done(err) }
          server.start({apiPort: 8080}, () => done())
        })
      })
    )

    after(done =>
      auth.cleanupTestUsers(err => {
        if (err) { return done(err) }
        ChannelModelAPI.remove(err => {
          if (err) { return done(err) }
          server.stop(() => done())
        })
      })
    )

    beforeEach(() => { authDetails = auth.getAuthDetails() })

    describe('*restart()', () => {
      it('should successfully send API request to restart the server', (done) => {
        const stub = sinon.stub(server, 'startRestartServerTimeout')
        request('https://localhost:8080')
          .post('/restart')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send()
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err)
            } else {
              stub.calledOnce.should.be.true
              return done()
            }
          })
      })

      it('should not allow non admin user to restart the server', done =>
        request('https://localhost:8080')
          .post('/restart')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send()
          .expect(403)
          .end((err, res) => {
            if (err) {
              return done(err)
            } else {
              return done()
            }
          })
      )
    })
  })
)
