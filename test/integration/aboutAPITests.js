/* eslint-env mocha */
import request from 'supertest'
import * as server from '../../src/server'
import * as testUtils from '../testUtils'

const {auth} = testUtils

xxdescribe('API Integration Tests', () =>

  xxdescribe('About Information REST Api Testing', () => {
    let authDetails = {}

    before(done =>
      server.start({apiPort: 8080}, (err) => {
        if (err) return done(err)
        auth.setupTestUsers((err) => {
          if (err) { return done(err) }
          authDetails = auth.getAuthDetails()
          return done()
        })
      })
    )

    after(done =>
      server.stop(() =>
        auth.cleanupTestUsers(err => {
          if (err) { return done(err) }
          done()
        })
      )
    )

    xxdescribe('*getAboutInformation', () => {
      it('should fetch core version and return status 200', done =>
        request('https://localhost:8080')
          .get('/about')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err)
            } else {
              res.body.should.have.property('currentCoreVersion')
              return done()
            }
          })
      )

      it('should return 404 if not found', done =>
        request('https://localhost:8080')
          .get('/about/bleh')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(404)
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
