/* eslint-env mocha */
/* eslint no-unused-expressions:0 */

import request from 'supertest'
import sinon from 'sinon'
import mongoose from 'mongoose'
import * as server from '../../src/server'
import * as tcpAdapter from '../../src/tcpAdapter'
import * as polling from '../../src/polling'
import { ChannelModelAPI } from '../../src/model/channels'
import { TransactionModelAPI } from '../../src/model/transactions'
import * as testUtils from '../utils'
import { promisify } from 'util'
import * as constants from '../constants'

const { SERVER_PORTS } = constants

describe('API Integration Tests', () =>

  describe('Channels REST Api testing', () => {
    const channel1 = {
      name: 'TestChannel1',
      urlPattern: 'test/sample',
      allow: ['PoC', 'Test1', 'Test2'],
      routes: [{
        name: 'test route',
        host: 'localhost',
        port: 9876,
        primary: true
      }
      ],
      txViewAcl: 'aGroup'
    }

    const channel2 = {
      name: 'TestChannel2',
      urlPattern: 'test/sample',
      allow: ['PoC', 'Test1', 'Test2'],
      routes: [{
        name: 'test route',
        host: 'localhost',
        port: 9876,
        primary: true
      }
      ],
      txViewAcl: 'group1'
    }

    let authDetails = {}

    before(async () => {
      await testUtils.setupTestUsers()
      await promisify(server.start)({ apiPort: SERVER_PORTS.apiPort, tcpHttpReceiverPort: SERVER_PORTS.tcpHttpReceiverPort })
      authDetails = await testUtils.getAuthDetails()
    })

    after(async () => {
      await Promise.all([
        TransactionModelAPI.remove(),
        ChannelModelAPI.remove(),
        testUtils.cleanupTestUsers(),
        promisify(server.stop)()
      ])
    })

    beforeEach(async () => {
      await Promise.all([
        TransactionModelAPI.remove(),
        ChannelModelAPI.remove()
      ])
      const ch1 = await (new ChannelModelAPI(channel1)).save()
      channel1._id = ch1._id
      const ch2 = await (new ChannelModelAPI(channel2)).save()
      channel2._id = ch2._id
    })

    describe('*getChannels()', () => {
      it('should fetch all channels', async () => {
        const result = await request(constants.BASE_URL)
          .get('/channels')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)
        result.body.length.should.be.eql(2)
      })

      it('should only allow non root user to fetch channel that they are allowed to view', async () => {
        const result = await request(constants.BASE_URL)
          .get('/channels')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)
        result.body.length.should.be.eql(1)
        result.body[0].name.should.be.eql('TestChannel2')
      })
    })

    describe('*addChannel()', () => {
      it('should add a new channel', async () => {
        const newChannel = {
          name: 'NewChannel',
          urlPattern: 'test/sample',
          allow: ['PoC', 'Test1', 'Test2'],
          routes: [{
            name: 'test route',
            host: 'localhost',
            port: 9876,
            primary: true
          }]
        }
        await request(constants.BASE_URL)
          .post('/channels')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(newChannel)
          .expect(201)
        const channel = await ChannelModelAPI.findOne({ name: 'NewChannel' })
        channel.should.have.property('urlPattern', 'test/sample')
        channel.allow.should.have.length(3)
      })

      it('should reject a channel without a name', async () => {
        const newChannel = {
          urlPattern: 'test/sample',
          allow: ['PoC', 'Test1', 'Test2'],
          routes: [{
            name: 'test route',
            host: 'localhost',
            port: 9876,
            primary: true
          }]
        }

        await request(constants.BASE_URL)
          .post('/channels')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(newChannel)
          .expect(400)
      })

      it('should reject invalid channels with invalid pathTransform', async () => {
        const invalidChannel = {
          name: 'InvalidChannel',
          urlPattern: 'test/sample',
          allow: ['PoC', 'Test1', 'Test2'],
          routes: [{
            name: 'test route',
            host: 'localhost',
            pathTransform: 'invalid',
            port: 9876,
            primary: true
          }]
        }

        await request(constants.BASE_URL)
          .post('/channels')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(invalidChannel)
          .expect(400)
      })

      it('should reject channels containing both path and pathTransform', async () => {
        const invalidChannel = {
          name: 'InvalidChannel',
          urlPattern: 'test/sample',
          allow: ['PoC', 'Test1', 'Test2'],
          routes: [{
            name: 'test route',
            host: 'localhost',
            path: '/target',
            pathTransform: 's/foo/bar',
            port: 9876,
            primary: true
          }]
        }

        await request(constants.BASE_URL)
          .post('/channels')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(invalidChannel)
          .expect(400)
      })

      it('should not allow a non admin user to add a channel', async () => {
        const newChannel = {}

        await request(constants.BASE_URL)
          .post('/channels')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(newChannel)
          .expect(403)
      })

      it('should notify master to startup TCP server if the new channel is of type "tcp"', async () => {
        const tcpChannel = {
          name: 'TCPTestChannel-Add',
          urlPattern: '/',
          allow: ['tcp'],
          type: 'tcp',
          tcpHost: '0.0.0.0',
          tcpPort: SERVER_PORTS.tcpPort,
          routes: [{
            name: 'TcpRoute',
            host: 'localhost',
            port: 9876,
            primary: true,
            type: 'tcp'
          }]
        }

        const stub = sinon.stub(tcpAdapter, 'notifyMasterToStartTCPServer')

        await request(constants.BASE_URL)
          .post('/channels')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(tcpChannel)
          .expect(201)
        stub.should.be.calledOnce
        stub.restore()
      })

      it('should NOT notify master to startup TCP server if the new channel is of type "tcp" but is disabled', async () => {
        const tcpChannelDisabled = {
          name: 'TCPTestChannel-Add-Disabled',
          urlPattern: '/',
          allow: ['tcp'],
          type: 'tcp',
          tcpHost: '0.0.0.0',
          tcpPort: SERVER_PORTS.tcpPort,
          routes: [{
            name: 'TcpRoute',
            host: 'localhost',
            port: 9876,
            primary: true,
            type: 'tcp'
          }],
          status: 'disabled'
        }

        const stub = sinon.stub(tcpAdapter, 'notifyMasterToStartTCPServer')

        await request(constants.BASE_URL)
          .post('/channels')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(tcpChannelDisabled)
          .expect(201)
        stub.should.not.be.called
        stub.restore()
      })

      it('should register the channel with the polling service if of type "polling"', async () => {
        const pollChannel = {
          name: 'POLLINGTestChannel-Add',
          urlPattern: '/trigger',
          allow: ['polling'],
          type: 'polling',
          pollingSchedule: '5 * * * *',
          routes: [{
            name: 'PollRoute',
            host: 'localhost',
            port: 9876,
            primary: true
          }]
        }

        const spy = sinon.spy(polling, 'registerPollingChannel')

        await request(constants.BASE_URL)
          .post('/channels')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(pollChannel)
          .expect(201)

        spy.restore()
        spy.calledOnce.should.be.true
        spy.getCall(0).args[0].should.have.property('name', 'POLLINGTestChannel-Add')
        spy.getCall(0).args[0].should.have.property('urlPattern', '/trigger')
        spy.getCall(0).args[0].should.have.property('type', 'polling')
      })

      it('should NOT register the channel with the polling service if of type "polling" but is disabled', async () => {
        const pollChannelDisabled = {
          name: 'POLLINGTestChannel-Add-Disabled',
          urlPattern: '/trigger',
          allow: ['polling'],
          type: 'polling',
          pollingSchedule: '5 * * * *',
          routes: [{
            name: 'PollRoute',
            host: 'localhost',
            port: 9876,
            primary: true
          }],
          status: 'disabled'
        }

        const spy = sinon.spy(polling, 'registerPollingChannel')

        await request(constants.BASE_URL)
          .post('/channels')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(pollChannelDisabled)
          .expect(201)
        spy.restore()
        spy.callCount.should.be.exactly(0)
      })

      it('should reject a channel without a primary route', async () => {
        const newChannel = {
          name: 'no-primary-route-test',
          urlPattern: 'test/sample',
          allow: ['PoC', 'Test1', 'Test2'],
          routes: [{
            name: 'test route',
            host: 'localhost',
            port: 9876
          }]
        }

        await request(constants.BASE_URL)
          .post('/channels')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(newChannel)
          .expect(400)
      })

      it('should reject a channel with multiple primary routes', async () => {
        const newChannel = {
          name: 'mulitple-primary-route-test',
          urlPattern: 'test/sample',
          allow: ['PoC', 'Test1', 'Test2'],
          routes: [
            {
              name: 'test route',
              host: 'localhost',
              port: 9876,
              primary: true
            }, {
              name: 'test route 2',
              host: 'localhost',
              port: 9877,
              primary: true
            }]
        }

        await request(constants.BASE_URL)
          .post('/channels')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(newChannel)
          .expect(400)
      })

      it('should accept a channel with one enabled primary route but multiple disabled primary routes', async () => {
        const newChannel = {
          name: 'disabled-primary-route-test',
          urlPattern: 'test/sample',
          allow: ['PoC', 'Test1', 'Test2'],
          routes: [
            {
              name: 'test route',
              host: 'localhost',
              port: 9876,
              primary: true
            }, {
              name: 'test route 2',
              host: 'localhost',
              port: 9877,
              primary: true,
              status: 'disabled'
            }]
        }

        await request(constants.BASE_URL)
          .post('/channels')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(newChannel)
          .expect(201)
      })

      it('should reject a channel with a priority below 1', async () => {
        const newChannel = {
          name: 'Channel-Priority--1',
          urlPattern: 'test/sample',
          priority: -1,
          allow: ['PoC', 'Test1', 'Test2'],
          routes: [{
            name: 'test route',
            host: 'localhost',
            port: 9876,
            primary: true
          }]
        }

        await request(constants.BASE_URL)
          .post('/channels')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(newChannel)
          .expect(400)
      })
    })

    describe('*getChannel(channelId)', () => {
      it('should fetch a specific channel by id', async () => {
        const res = await request(constants.BASE_URL)
          .get(`/channels/${channel1._id}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)
        res.body.should.have.property('name', 'TestChannel1')
        res.body.should.have.property('urlPattern', 'test/sample')
        res.body.allow.should.have.length(3)
      })

      it('should not allow a non admin user from fetching a channel they dont have access to by name', async () => {
        await request(constants.BASE_URL)
          .get(`/channels/${channel1._id}`)
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
      })

      it('should allow a non admin user to fetch a channel they have access to by name', async () => {
        const res = await request(constants.BASE_URL)
          .get(`/channels/${channel2._id}`)
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)
        res.body.should.have.property('name', 'TestChannel2')
        res.body.should.have.property('urlPattern', 'test/sample')
        res.body.allow.should.have.length(3)
      })

      it('should return a 404 if that channel doesnt exist', async () => {
        await request(constants.BASE_URL)
          .get('/channels/999999999999999999999999')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(404)
      })
    })

    describe('*updateChannel(channelId)', () => {
      it('should update a specific channel by id', async () => {
        const updates = {
          _id: 'thisShouldBeIgnored',
          urlPattern: 'test/changed',
          allow: ['PoC', 'Test1', 'Test2', 'another'],
          routes: [{
            name: 'test route',
            host: 'localhost',
            port: 9876,
            primary: true
          },
          {
            name: 'test route2',
            host: 'localhost',
            port: 8899
          }]
        }

        await request(constants.BASE_URL)
          .put(`/channels/${channel1._id}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updates)
          .expect(200)
        const channel = await ChannelModelAPI.findOne({ name: 'TestChannel1' })
        channel.should.have.property('name', 'TestChannel1')
        channel.should.have.property('urlPattern', 'test/changed')
        channel.allow.should.have.length(4)
        channel.routes.should.have.length(2)
      })

      it('should not allow a non admin user to update a channel', async () => {
        const updates = {}
        await request(constants.BASE_URL)
          .put(`/channels/${channel1._id}`)
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updates)
          .expect(403)
      })

      it('should notify master to startup a TCP server if the type is set to "tcp"', async () => {
        const httpChannel = new ChannelModelAPI({
          name: 'TestChannelForTCPUpdate',
          urlPattern: '/',
          allow: ['test'],
          routes: [{
            name: 'test route',
            host: 'localhost',
            port: 9876,
            primary: true
          }],
          txViewAcl: 'group1'
        })

        const changeToTCP = {
          type: 'tcp',
          tcpHost: '0.0.0.0',
          tcpPort: 3601
        }

        const stub = sinon.stub(tcpAdapter, 'notifyMasterToStartTCPServer')

        await httpChannel.save()
        await request(constants.BASE_URL)
          .put(`/channels/${httpChannel._id}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(changeToTCP)
          .expect(200)

        stub.should.be.calledOnce()
        stub.restore()
      })

      it('should NOT notify master to startup a TCP server if the type is set to "tcp" but it is disabled', async () => {
        const httpChannel = new ChannelModelAPI({
          name: 'TestChannelForTCPUpdate-Disabled',
          urlPattern: '/',
          allow: ['test'],
          routes: [{
            name: 'test route',
            host: 'localhost',
            port: 9876,
            primary: true
          }],
          txViewAcl: 'group1'
        })

        const changeToTCPDisabled = {
          type: 'tcp',
          tcpHost: '0.0.0.0',
          tcpPort: 3603,
          status: 'disabled'
        }

        const startStub = sinon.stub(tcpAdapter, 'notifyMasterToStartTCPServer')
        const stopStub = sinon.stub(tcpAdapter, 'notifyMasterToStopTCPServer')

        httpChannel.save()
        await request(constants.BASE_URL)
          .put(`/channels/${httpChannel._id}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(changeToTCPDisabled)
          .expect(200)
        startStub.should.not.be.called()
        stopStub.should.be.calledOnce()
        startStub.restore()
        stopStub.restore()
      })

      it('should register the updated channel with the polling service if of type "polling"', async () => {
        const pollChannel = new ChannelModelAPI({
          name: 'POLLINGTestChannel-Update',
          urlPattern: '/trigger',
          allow: ['polling'],
          type: 'polling',
          pollingSchedule: '5 * * * *',
          routes: [{
            name: 'PollRoute',
            host: 'localhost',
            port: 9876,
            primary: true
          }]
        })

        const spy = sinon.spy(polling, 'registerPollingChannel')

        pollChannel.save()
        await request(constants.BASE_URL)
          .put(`/channels/${pollChannel._id}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(pollChannel)
          .expect(200)
        spy.restore()
        spy.calledOnce.should.be.true
        spy.getCall(0).args[0].should.have.property('name', 'POLLINGTestChannel-Update')
        spy.getCall(0).args[0].should.have.property('urlPattern', '/trigger')
        spy.getCall(0).args[0].should.have.property('type', 'polling')
        spy.getCall(0).args[0].should.have.property('_id', pollChannel._id)
      })

      it('should NOT register the updated channel with the polling service if of type "polling" but it is disabled', async () => {
        const pollChannel = new ChannelModelAPI({
          name: 'POLLINGTestChannel-Update-Disabled',
          urlPattern: '/trigger',
          allow: ['polling'],
          type: 'polling',
          pollingSchedule: '5 * * * *',
          routes: [{
            name: 'PollRoute',
            host: 'localhost',
            port: 9876,
            primary: true
          }],
          status: 'disabled'
        })

        const spy = sinon.spy(polling, 'registerPollingChannel')

        pollChannel.save()
        await request(constants.BASE_URL)
          .put(`/channels/${pollChannel._id}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(pollChannel)
          .expect(200)
        spy.restore()
        spy.callCount.should.be.exactly(0)
      })

      it('should reject an update with no primary routes', async () => {
        const updates = {
          urlPattern: 'test/changed',
          allow: ['PoC', 'Test1', 'Test2', 'another'],
          routes: [{
            name: 'test route',
            host: 'localhost',
            port: 9876
          },
          {
            name: 'test route2',
            host: 'localhost',
            port: 8899
          }]
        }

        await request(constants.BASE_URL)
          .put(`/channels/${channel1._id}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updates)
          .expect(400)
      })

      it('should reject an update with multiple primary routes', async () => {
        const updates = {
          urlPattern: 'test/changed',
          allow: ['PoC', 'Test1', 'Test2', 'another'],
          routes: [{
            name: 'test route',
            host: 'localhost',
            port: 9876,
            primary: true
          },
          {
            name: 'test route2',
            host: 'localhost',
            port: 8899,
            primary: true
          }]
        }

        await request(constants.BASE_URL)
          .put(`/channels/${channel1._id}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updates)
          .expect(400)
      })

      it('should accept an update with one primary route and multiple disabled primary routes', async () => {
        const updates = {
          urlPattern: 'test/changed',
          allow: ['PoC', 'Test1', 'Test2', 'another'],
          routes: [{
            name: 'test route',
            host: 'localhost',
            port: 9876,
            primary: true
          },
          {
            name: 'test route2',
            host: 'localhost',
            port: 8899,
            primary: true,
            status: 'disabled'
          }]
        }

        await request(constants.BASE_URL)
          .put(`/channels/${channel1._id}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updates)
          .expect(200)
      })

      it('should NOT update a channel with a priority below 1', async () => {
        const updates = {
          urlPattern: 'test/changed',
          priority: -1
        }

        await request(constants.BASE_URL)
          .put(`/channels/${channel1._id}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(updates)
          .expect(400)
        const channel = await ChannelModelAPI.findOne({ name: 'TestChannel1' })
        channel.should.have.property('urlPattern', 'test/sample')
      })
    })

    describe('*removeChannel(channelId)', () => {
      it('should remove a specific channel by name', async () => {
        const trx = await TransactionModelAPI.find({ channelID: channel1._id })
        // there can't be any linked transactions
        trx.length.should.be.exactly(0)

        await request(constants.BASE_URL)
          .del(`/channels/${channel1._id}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)
        const channels = await ChannelModelAPI.find({ name: 'TestChannel1' })
        channels.should.have.length(0)
      })

      it('should only allow an admin user to remove a channel', async () => {
        await request(constants.BASE_URL)
          .del(`/channels/${channel1._id}`)
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
      })

      it('should remove polling schedule if the channel is of type "polling"', async () => {
        const pollChannel = new ChannelModelAPI({
          name: 'POLLINGTestChannel-Remove',
          urlPattern: '/trigger',
          allow: ['polling'],
          type: 'polling',
          pollingSchedule: '5 * * * *',
          routes: [{
            name: 'PollRoute',
            host: 'localhost',
            port: 9876,
            primary: true
          }]
        })

        const spy = sinon.spy(polling, 'removePollingChannel')

        const trx = await TransactionModelAPI.find({ channelID: channel1._id })
        // there can't be any linked transactions
        trx.length.should.be.exactly(0)

        pollChannel.save()
        await request(constants.BASE_URL)
          .del(`/channels/${pollChannel._id}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)
        spy.restore()
        spy.calledOnce.should.be.true
        spy.getCall(0).args[0].should.have.property('name', 'POLLINGTestChannel-Remove')
        spy.getCall(0).args[0].should.have.property('_id', pollChannel._id)
      })

      it('should NOT remove a specific channel if any transactions are linked to it but mark the status as deleted', async () => {
        const trx = new TransactionModelAPI({
          clientID: channel1._id, // not really but anyway
          channelID: channel1._id,
          request: {
            path: '/test/remove',
            method: 'GET',
            timestamp: new Date()
          },
          status: 'Successful'
        })

        trx.save()
        await request(constants.BASE_URL)
          .del(`/channels/${channel1._id}`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)
        const channels = await ChannelModelAPI.find({ name: 'TestChannel1' })
        channels.should.have.length(1)
        channels[0].status.should.exist
        channels[0].status.should.be.equal('deleted')
      })
    })

    describe('*manuallyPollChannel', () => {
      it('should manually poll a channel', async () => {
        await request(constants.BASE_URL)
          .post(`/channels/${channel1._id}/trigger`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)
      })

      it('should reject a manually polled channel - channel not found', async () => {
        const invalidId = mongoose.Types.ObjectId('4eeeeeeeeeeeeeeeebbbbbb2')
        await request(constants.BASE_URL)
          .post(`/channels/${invalidId}/trigger`)
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(404)
      })

      it('should not allow a non admin user from manually polling a channel they do not have access to', async () => {
        await request(constants.BASE_URL)
          .post(`/channels/${channel1._id}/trigger`)
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
      })
    })
  })
)
