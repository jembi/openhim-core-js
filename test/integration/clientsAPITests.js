/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import should from 'should'
import request from 'supertest'
import { ClientModelAPI } from '../../src/model/clients'
import * as server from '../../src/server'
import * as testUtils from '../testUtils'

const {auth} = testUtils

describe('API Integration Tests', () =>

  describe('Clients REST Api Testing', () => {
    const testAppDoc = {
      clientID: 'YUIAIIIICIIAIA',
      clientDomain: 'him.jembi.org',
      name: 'OpenMRS Ishmael instance',
      roles: [
        'OpenMRS_PoC',
        'PoC'
      ],
      passwordHash: '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy',
      certFingerprint: '23:37:6A:5E:A9:13:A4:8C:66:C5:BB:9F:0E:0D:68:9B:99:80:10:FC'
    }

    let authDetails = {}

    before(done =>
      auth.setupTestUsers(err => {
        if (err) { return done(err) }
        server.start({apiPort: 8080}, () => done())
      })
    )

    after(done =>
      auth.cleanupTestUsers(err => {
        if (err) { return done(err) }
        server.stop(() => done())
      })
    )

    beforeEach(() => { authDetails = auth.getAuthDetails() })

    afterEach(done =>
      ClientModelAPI.remove(() => done())
    )

    describe('*addClient', () => {
      it('should add client to db and return status 201 - client created', done =>
        request('https://localhost:8080')
          .post('/clients')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(testAppDoc)
          .expect(201)
          .end((err, res) => {
            if (err) {
              return done(err)
            } else {
              ClientModelAPI.findOne({clientID: 'YUIAIIIICIIAIA'}, (err, client) => {
                if (err) { return done(err) }
                client.clientID.should.equal('YUIAIIIICIIAIA')
                client.clientDomain.should.equal('him.jembi.org')
                client.name.should.equal('OpenMRS Ishmael instance')
                client.roles[0].should.equal('OpenMRS_PoC')
                client.roles[1].should.equal('PoC')
                client.passwordHash.should.equal('$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy')
                client.certFingerprint.should.equal('23:37:6A:5E:A9:13:A4:8C:66:C5:BB:9F:0E:0D:68:9B:99:80:10:FC')
                return done()
              })
            }
          })
      )

      it('should only allow an admin user to add a client', done =>
        request('https://localhost:8080')
          .post('/clients')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(testAppDoc)
          .expect(403)
          .end((err, res) => {
            if (err) {
              return done(err)
            } else {
              return done()
            }
          })
      )

      it('should reject a client that conflicts with a role', (done) => {
        const client = new ClientModelAPI(testAppDoc)
        client.save(() => {
          const conflict = Object.assign({}, testAppDoc)
          conflict.clientID = 'PoC'
          request('https://localhost:8080')
            .post('/clients')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(conflict)
            .expect(409)
            .end((err, res) => {
              if (err) {
                return done(err)
              } else {
                return done()
              }
            })
        })
      })
    })

    describe('*getClient(_id)', () => {
      const clientTest = {
        clientID: 'testClient',
        clientDomain: 'www.zedmusic-unique.co.zw',
        name: 'OpenHIE NodeJs',
        roles: [
          'test_role_PoC',
          'monitoring'
        ],
        passwordHash: '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy'
      }

      let clientId = null

      beforeEach((done) => {
        const client = new ClientModelAPI(clientTest)
        client.save((err, client) => {
          clientId = client._id
          if (err) { done(err) }
          return done()
        })
      })

      it('should get client by clientId and return status 200', done =>
        request('https://localhost:8080')
          .get(`/clients/${clientId}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err)
            } else {
              res.body.clientID.should.equal('testClient')
              res.body.clientDomain.should.equal('www.zedmusic-unique.co.zw')
              res.body.name.should.equal('OpenHIE NodeJs')
              res.body.roles[0].should.equal('test_role_PoC')
              res.body.roles[1].should.equal('monitoring')
              res.body.passwordHash.should.equal('$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy')
              return done()
            }
          })
      )

      it('should return status 404 if not found', done =>
        request('https://localhost:8080')
          .get('/clients/000000000000000000000000')
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

      it('should not allow a non admin user to fetch a client', done =>
        request('https://localhost:8080')
          .get(`/clients/${clientId}`)
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
          .end((err, res) => {
            if (err) {
              return done(err)
            } else {
              return done()
            }
          })
      )

      it('should allow a non admin user to fetch a limited view of a client', done =>
        request('https://localhost:8080')
          .get(`/clients/${clientId}/clientName`)
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err)
            } else {
              res.body.name.should.equal('OpenHIE NodeJs')

              should.not.exist(res.body.clientID)
              should.not.exist(res.body.domainName)
              should.not.exist(res.body.roles)
              should.not.exist(res.body.passwordHash)
              return done()
            }
          })
      )
    })

    describe('*findClientByDomain(clientDomain)', () => {
      const clientTest = {
        clientID: 'Zambia_OpenHIE_Instance',
        clientDomain: 'www.zedmusic-unique.co.zw',
        name: 'OpenHIE NodeJs',
        roles: [
          'test_role_PoC',
          'monitoring'
        ],
        passwordHash: '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy'
      }

      it('should return client with specified clientDomain', (done) => {
        const client = new ClientModelAPI(clientTest)
        client.save((error, newApp) => {
          should.not.exist((error))
          request('https://localhost:8080')
            .get('/clients/domain/www.zedmusic-unique.co.zw')
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err)
              } else {
                res.body.clientID.should.equal('Zambia_OpenHIE_Instance')
                res.body.clientDomain.should.equal('www.zedmusic-unique.co.zw')
                res.body.name.should.equal('OpenHIE NodeJs')
                res.body.roles[0].should.equal('test_role_PoC')
                res.body.roles[1].should.equal('monitoring')
                res.body.passwordHash.should.equal('$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy')
                return done()
              }
            })
        })
      })

      it('should not allow a non admin user to fetch a client by domain', done =>
        request('https://localhost:8080')
          .get('/clients/domain/www.zedmusic-unique.co.zw')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
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

    describe('*getClients()', () => {
      const testDocument = {
        clientID: 'Botswana_OpenHIE_Instance',
        clientDomain: 'www.zedmusic.co.zw',
        name: 'OpenHIE NodeJs',
        roles: [
          'test_role_PoC',
          'analysis_POC'
        ],
        passwordHash: '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy'
      }

      it('should return all clients ', done =>
        ClientModelAPI.count((err, countBefore) => {
          if (err) { return done(err) }
          let client = new ClientModelAPI(testDocument)
          client.clientID += '1'
          client.save((error, testDoc) => {
            should.not.exist((error))
            client = new ClientModelAPI(testDocument)
            client.clientID += '2'
            client.save((error, testDoc) => {
              should.not.exist(error)
              client = new ClientModelAPI(testDocument)
              client.clientID += '3'
              client.save((error, testDoc) => {
                should.not.exist(error)
                client = new ClientModelAPI(testDocument)
                client.clientID += '4'
                client.save((error, testDoc) => {
                  should.not.exist((error))
                  request('https://localhost:8080')
                    .get('/clients')
                    .set('auth-username', testUtils.rootUser.email)
                    .set('auth-ts', authDetails.authTS)
                    .set('auth-salt', authDetails.authSalt)
                    .set('auth-token', authDetails.authToken)
                    .expect(200)
                    .end((err, res) => {
                      if (err) {
                        return done(err)
                      } else {
                        res.body.length.should.equal(countBefore + 4)
                        return done()
                      }
                    })
                })
              })
            })
          })
        })
      )

      it('should not allow a non admin user to fetch all clients', done =>
        request('https://localhost:8080')
          .get('/clients')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
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

    describe('*updateClient', () => {
      const testDocument = {
        clientID: 'Botswana_OpenHIE_Instance',
        clientDomain: 'www.zedmusic.co.zw',
        name: 'OpenHIE NodeJs',
        roles: [
          'test_role_PoC',
          'analysis_POC'
        ],
        passwordHash: '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy'
      }

      it('should update the specified client ', (done) => {
        const client = new ClientModelAPI(testDocument)
        client.save((error, testDoc) => {
          should.not.exist((error))

          const updates = {
            _id: 'thisShouldBeIgnored',
            roles: [
              'clientTest_update'
            ],
            passwordHash: '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy',
            name: 'Devil_may_Cry'
          }
          request('https://localhost:8080')
            .put(`/clients/${client._id}`)
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(updates)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err)
              } else {
                ClientModelAPI.findById(client._id, (err, clientDoc) => {
                  if (err) { return done(err) }
                  clientDoc.roles[0].should.equal('clientTest_update')
                  clientDoc.passwordHash.should.equal('$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy')
                  clientDoc.name.should.equal('Devil_may_Cry')
                  return done()
                })
              }
            })
        })
      })

      it('should update successfully if the _id field is present in update, ignoring it', (done) => {
        const client = new ClientModelAPI(testDocument)
        client.save((error, testDoc) => {
          should.not.exist((error))

          const updates = {
            _id: 'not_a_real_id',
            roles: [
              'clientTest_update'
            ],
            passwordHash: '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy',
            name: 'Devil_may_Cry'
          }
          request('https://localhost:8080')
            .put(`/clients/${client._id}`)
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(updates)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err)
              } else {
                ClientModelAPI.findById(client._id, (err, clientDoc) => {
                  if (err) { return done(err) }
                  clientDoc.roles[0].should.equal('clientTest_update')
                  clientDoc.passwordHash.should.equal('$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy')
                  clientDoc.name.should.equal('Devil_may_Cry')
                  return done()
                })
              }
            })
        })
      })

      it('should not allow a non admin user to update a client', (done) => {
        const updates = {}
        request('https://localhost:8080')
          .put('/clients/000000000000000000000000')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updates)
          .expect(403)
          .end((err, res) => {
            if (err) {
              return done(err)
            } else {
              return done()
            }
          })
      })

      it('should reject a client that conflicts with a role', (done) => {
        const client = new ClientModelAPI(testAppDoc)
        client.save(() => {
          const conflict = {clientID: 'PoC'}
          request('https://localhost:8080')
            .put(`/clients/${client._id}`)
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(conflict)
            .expect(409)
            .end((err, res) => {
              if (err) {
                return done(err)
              } else {
                return done()
              }
            })
        })
      })
    })

    describe('*removeClient', () => {
      it('should remove an client with specified clientID', (done) => {
        const docTestRemove = {
          clientID: 'Jembi_OpenHIE_Instance',
          clientDomain: 'www.jembi.org',
          name: 'OpenHIE NodeJs',
          roles: [
            'test_role_PoC',
            'analysis_POC'
          ],
          passwordHash: '$2a$10$w8GyqInkl72LMIQNpMM/fenF6VsVukyya.c6fh/GRtrKq05C2.Zgy'
        }

        const client = new ClientModelAPI(docTestRemove)
        client.save((error, testDoc) => {
          should.not.exist(error)
          ClientModelAPI.count((err, countBefore) => {
            if (err) { return done(err) }
            request('https://localhost:8080')
                .del(`/clients/${client._id}`)
                .set('auth-username', testUtils.rootUser.email)
                .set('auth-ts', authDetails.authTS)
                .set('auth-salt', authDetails.authSalt)
                .set('auth-token', authDetails.authToken)
                .expect(200)
                .end((err, res) => {
                  if (err) {
                    return done(err)
                  } else {
                    ClientModelAPI.count((err, countAfter) => {
                      if (err) { return done(err) }
                      ClientModelAPI.findOne({clientID: 'Jembi_OpenHIE_Instance'}, (err, notFoundDoc) => {
                        if (err) { return done(err) }
                        (notFoundDoc === null).should.be.true;
                        (countBefore - 1).should.equal(countAfter)
                        return done()
                      })
                    }
                    )
                  }
                })
          }
          )
        })
      })

      it('should not allow a non admin user to remove a client', (done) => {
        request('https://localhost:8080')
          .del('/clients/000000000000000000000000')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
          .end((err, res) => {
            if (err) {
              return done(err)
            } else {
              return done()
            }
          })
      })
    })
  })
)
