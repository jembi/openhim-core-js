/* eslint-env mocha */

import should from 'should'
import { Types } from 'mongoose'
import * as messageStore from '../../src/middleware/messageStore'
import { TransactionModel } from '../../src/model/transactions'
import { ChannelModel } from '../../src/model/channels'
import * as utils from '../../src/utils'

const { ObjectId } = Types

describe('MessageStore', () => {
  const channel1 = {
    name: 'TestChannel1',
    urlPattern: 'test/sample',
    allow: ['PoC', 'Test1', 'Test2'],
    routes: [
      {
        name: 'test route',
        host: 'localhost',
        port: 9876,
        primary: true
      },
      {
        name: 'test route 2',
        host: 'localhost',
        port: 9876,
        primary: true
      }
    ],
    txViewAcl: 'aGroup',
    updatedBy: {
      id: new ObjectId(),
      name: 'Test'
    }
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
    txViewAcl: 'group1',
    updatedBy: {
      id: new ObjectId(),
      name: 'Test'
    }
  }

  const req = {}
  req.path = '/api/test/request'
  req.headers = {
    headerName: 'headerValue',
    'Content-Type': 'application/json',
    'Content-Length': '9313219921'
  }
  req.querystring = 'param1=value1&param2=value2'
  req.body = '<HTTP body>'
  req.method = 'POST'
  req.timestamp = new Date()

  const res = {}
  res.status = '200'
  res.headers = {
    header: 'value',
    header2: 'value2'
  }
  res.body = '<HTTP response>'
  res.timestamp = new Date()

  let ctx = null

  beforeEach(async () => {
    ctx = {}
    ctx.host = 'localhost:5000'
    ctx.path = '/api/test/request'
    ctx.header = {
      headerName: 'headerValue',
      'Content-Type': 'application/json',
      'Content-Length': '9313219921'
    }

    ctx.querystring = 'param1=value1&param2=value2'
    ctx.body = '<HTTP body>'
    ctx.method = 'POST'

    ctx.status = 'Processing'
    ctx.authenticated = {}
    ctx.authenticated._id = new ObjectId('313233343536373839319999')

    ctx.authorisedChannel = {}
    ctx.authorisedChannel.requestBody = true
    ctx.authorisedChannel.responseBody = true

    await Promise.all([
      TransactionModel.remove({}),
      ChannelModel.remove({})
    ])

    const [ch1, ch2] = await Promise.all([
      new ChannelModel(channel1).save(),
      new ChannelModel(channel2).save()
    ])

    channel1._id = ch1._id
    ctx.authorisedChannel._id = ch1._id
    channel2._id = ch2._id
  })

  afterEach(async () => {
    await Promise.all([
      TransactionModel.remove({}),
      ChannelModel.remove({})
    ])
  })

  describe('.storeTransaction', () => {
    it('should be able to save the transaction in the db', done => {
      messageStore.storeTransaction(ctx, (error, result) => {
        should.not.exist(error)
        TransactionModel.findOne({ _id: result._id }, (error, trans) => {
          should.not.exist(error);
          (trans !== null).should.be.true()
          trans.clientID.toString().should.equal('313233343536373839319999')
          trans.status.should.equal('Processing')
          trans.status.should.not.equal('None')
          trans.request.path.should.equal('/api/test/request')
          trans.request.headers['Content-Type'].should.equal('application/json')
          trans.request.querystring.should.equal('param1=value1&param2=value2')
          trans.request.host.should.equal('localhost')
          trans.request.port.should.equal('5000')
          trans.channelID.toString().should.equal(channel1._id.toString())
          return done()
        })
      })
    })

    it('should be able to save the transaction if the headers contain Mongo reserved characters ($ or .)', (done) => {
      ctx.header['dot.header'] = '123'
      ctx.header.dollar$header = '124'
      messageStore.storeTransaction(ctx, (error, result) => {
        // cleanup ctx before moving on in case there's a failure
        delete ctx.header['dot.header']
        delete ctx.header.dollar$header

        should.not.exist(error)
        TransactionModel.findOne({ _id: result._id }, (error, trans) => {
          should.not.exist(error);
          (trans !== null).should.be.true()
          trans.request.headers['dot．header'].should.equal('123')
          trans.request.headers['dollar＄header'].should.equal('124')
          ctx.header['X-OpenHIM-TransactionID'].should.equal(result._id.toString())
          return done()
        })
      })
    })

    it('should truncate the request body if it exceeds storage limits', (done) => {
      ctx.body = ''
      // generate a big body
      for (let i = 0, end = 2000 * 1024, asc = end >= 0; asc ? i < end : i > end; asc ? i++ : i--) {
        ctx.body += '1234567890'
      }

      messageStore.storeTransaction(ctx, (error, result) => {
        should.not.exist(error)
        TransactionModel.findOne({ _id: result._id }, (error, trans) => {
          should.not.exist(error);
          (trans !== null).should.be.true()
          trans.request.body.length.should.be.exactly(utils.MAX_BODIES_SIZE)
          trans.canRerun.should.be.false()
          return done()
        })
      })
    })
  })

  describe('.storeResponse', () => {
    // beforeEach(async () => {
    //   await ChannelModel.remove({})
    //   ChannelModel.remove({}, () =>
    //   (new ChannelModel(channel1)).save((err, ch1) => {
    //     if (err) { return done(err) }
    //     channel1._id = ch1._id
    //     ctx.authorisedChannel._id = ch1._id
    //     return (new ChannelModel(channel2)).save((err, ch2) => {
    //       if (err) { return done(err) }
    //       channel2._id = ch2._id
    //       return done()
    //     })
    //   })
    // )
    // })

    // afterEach(done =>
    //   TransactionModel.remove({}, () =>
    //     ChannelModel.remove({}, () => done())
    //   )
    // )

    const createResponse = status =>
      ({
        status,
        header: {
          testHeader: 'value'
        },
        body: Buffer.from('<HTTP response body>'),
        timestamp: new Date()
      })

    const createRoute = (name, status) =>
      ({
        name,
        request: {
          host: 'localhost',
          port: '4466',
          path: '/test',
          timestamp: new Date()
        },
        response: {
          status,
          headers: {
            test: 'test'
          },
          body: 'route body',
          timestamp: new Date()
        }
      })

    it('should update the transaction with the response', (done) => {
      ctx.response = createResponse(201)

      messageStore.storeTransaction(ctx, (err, storedTrans) => {
        should.not.exist(err)
        if (err != null) done(err)
        ctx.transactionId = storedTrans._id
        messageStore.storeResponse(ctx, (err2) => {
          should.not.exist(err2)
          if (err2 != null) done(err2)
          messageStore.setFinalStatus(ctx, () =>
            TransactionModel.findOne({ _id: storedTrans._id }, (err3, trans) => {
              should.not.exist(err3);
              (trans !== null).should.be.true()
              trans.response.status.should.equal(201)
              trans.response.headers.testHeader.should.equal('value')
              trans.response.body.should.equal('<HTTP response body>')
              trans.status.should.equal('Successful')
              return done(err3)
            })
          )
        })
      })
    })

    it('should update the transaction with the responses from non-primary routes', (done) => {
      ctx.response = createResponse(201)
      const route = createRoute('route1', 200)

      messageStore.storeTransaction(ctx, (err, storedTrans) => {
        if (err) { return done(err) }
        ctx.transactionId = storedTrans._id
        messageStore.storeResponse(ctx, (err2) => {
          should.not.exist(err2)
          messageStore.storeNonPrimaryResponse(ctx, route, () =>
            TransactionModel.findOne({ _id: storedTrans._id }, (err3, trans) => {
              should.not.exist(err3);
              (trans !== null).should.be.true()
              trans.routes.length.should.be.exactly(1)
              trans.routes[0].name.should.equal('route1')
              trans.routes[0].response.status.should.equal(200)
              trans.routes[0].response.headers.test.should.equal('test')
              trans.routes[0].response.body.should.equal('route body')
              trans.routes[0].request.path.should.equal('/test')
              trans.routes[0].request.host.should.equal('localhost')
              trans.routes[0].request.port.should.equal('4466')
              return done()
            })
          )
        })
      })
    })

    it('should set the ctx.transactionStatus variable with the final status', (done) => {
      ctx.response = createResponse(201)
      ctx.transactionStatus = null

      messageStore.storeTransaction(ctx, (err, storedTrans) => {
        if (err) { return done(err) }
        ctx.request = storedTrans.request
        ctx.request.header = {}
        ctx.transactionId = storedTrans._id
        ctx.request.header['X-OpenHIM-TransactionID'] = storedTrans._id
        messageStore.storeResponse(ctx, (err2) => {
          should.not.exist(err2)
          messageStore.setFinalStatus(ctx, () => {
            should(ctx.transactionStatus).be.exactly('Successful')
            return done()
          })
        })
      })
    })

    it('should set the status to successful if all route return a status in 2xx', (done) => {
      ctx.response = createResponse(201)
      const route1 = createRoute('route1', 200)
      const route2 = createRoute('route2', 201)

      messageStore.storeTransaction(ctx, (err, storedTrans) => {
        if (err) { return done(err) }
        ctx.request = storedTrans.request
        ctx.request.header = {}
        ctx.transactionId = storedTrans._id
        ctx.request.header['X-OpenHIM-TransactionID'] = storedTrans._id
        messageStore.storeResponse(ctx, err2 =>
          messageStore.storeNonPrimaryResponse(ctx, route1, () =>
            messageStore.storeNonPrimaryResponse(ctx, route2, () =>
              messageStore.setFinalStatus(ctx, () => {
                should.not.exist(err2)
                return TransactionModel.findOne({ _id: storedTrans._id }, (err3, trans) => {
                  should.not.exist(err3);
                  (trans !== null).should.be.true()
                  trans.status.should.be.exactly('Successful')
                  return done()
                })
              })
            )
          )
        )
      })
    })

    it('should set the status to failed if the primary route return a status in 5xx', (done) => {
      ctx.response = createResponse(500)
      ctx.routes = []
      ctx.routes.push(createRoute('route1', 200))
      ctx.routes.push(createRoute('route2', 201))

      messageStore.storeTransaction(ctx, (err, storedTrans) => {
        if (err) { return done(err) }
        ctx.request = storedTrans.request
        ctx.request.header = {}
        ctx.transactionId = storedTrans._id
        ctx.request.header['X-OpenHIM-TransactionID'] = storedTrans._id
        messageStore.storeResponse(ctx, err2 =>
          messageStore.storeNonPrimaryResponse(ctx, ctx.routes[0], () =>
            messageStore.storeNonPrimaryResponse(ctx, ctx.routes[1], () =>
              messageStore.setFinalStatus(ctx, () => {
                should.not.exist(err2)
                return TransactionModel.findOne({ _id: storedTrans._id }, (err3, trans) => {
                  should.not.exist(err3);
                  (trans !== null).should.be.true()
                  trans.status.should.be.exactly('Failed')
                  return done()
                })
              })
            )
          )
        )
      })
    })

    it('should set the status to completed with errors if the primary route return a status in 2xx or 4xx but one or more routes return 5xx',
      (done) => {
        ctx.response = createResponse(404)
        ctx.routes = []
        ctx.routes.push(createRoute('route1', 201))
        ctx.routes.push(createRoute('route2', 501))

        messageStore.storeTransaction(ctx, (err, storedTrans) => {
          if (err) { return done(err) }
          ctx.request = storedTrans.request
          ctx.request.header = {}
          ctx.transactionId = storedTrans._id
          ctx.request.header['X-OpenHIM-TransactionID'] = storedTrans._id
          messageStore.storeResponse(ctx, err2 =>
            messageStore.storeNonPrimaryResponse(ctx, ctx.routes[0], () =>
              messageStore.storeNonPrimaryResponse(ctx, ctx.routes[1], () =>
                messageStore.setFinalStatus(ctx, () => {
                  should.not.exist(err2)
                  return TransactionModel.findOne({ _id: storedTrans._id }, (err3, trans) => {
                    should.not.exist(err3);
                    (trans !== null).should.be.true()
                    trans.status.should.be.exactly('Completed with error(s)')
                    return done()
                  })
                })
              )
            )
          )
        })
      })

    it('should set the status to completed if any route returns a status in 4xx (test 1)', (done) => {
      ctx.response = createResponse(201)
      ctx.routes = []
      ctx.routes.push(createRoute('route1', 201))
      ctx.routes.push(createRoute('route2', 404))

      messageStore.storeTransaction(ctx, (err, storedTrans) => {
        if (err) { return done(err) }
        ctx.request = storedTrans.request
        ctx.request.header = {}
        ctx.transactionId = storedTrans._id
        ctx.request.header['X-OpenHIM-TransactionID'] = storedTrans._id
        messageStore.storeResponse(ctx, err2 =>
          messageStore.storeNonPrimaryResponse(ctx, ctx.routes[0], () =>
            messageStore.storeNonPrimaryResponse(ctx, ctx.routes[1], () =>
              messageStore.setFinalStatus(ctx, () => {
                should.not.exist(err2)
                return TransactionModel.findOne({ _id: storedTrans._id }, (err3, trans) => {
                  should.not.exist(err3);
                  (trans !== null).should.be.true()
                  trans.status.should.be.exactly('Completed')
                  return done()
                })
              })
            )
          )
        )
      })
    })

    it('should set the status to completed if any route returns a status in 4xx (test 2)', (done) => {
      ctx.response = createResponse(404)
      ctx.routes = []
      ctx.routes.push(createRoute('route1', 201))
      ctx.routes.push(createRoute('route2', 404))

      messageStore.storeTransaction(ctx, (err, storedTrans) => {
        if (err) { return done(err) }
        ctx.request = storedTrans.request
        ctx.request.header = {}
        ctx.transactionId = storedTrans._id
        ctx.request.header['X-OpenHIM-TransactionID'] = storedTrans._id
        messageStore.storeResponse(ctx, err2 =>
          messageStore.storeNonPrimaryResponse(ctx, ctx.routes[0], () =>
            messageStore.storeNonPrimaryResponse(ctx, ctx.routes[1], () =>
              messageStore.setFinalStatus(ctx, () => {
                should.not.exist(err2)
                return TransactionModel.findOne({ _id: storedTrans._id }, (err3, trans) => {
                  should.not.exist(err3);
                  (trans !== null).should.be.true()
                  trans.status.should.be.exactly('Completed')
                  return done()
                })
              })
            )
          )
        )
      })
    })

    it('should set the status to completed if any other response code is recieved on primary', (done) => {
      ctx.response = createResponse(302)
      ctx.routes = []
      ctx.routes.push(createRoute('route1', 201))
      ctx.routes.push(createRoute('route2', 200))

      messageStore.storeTransaction(ctx, (err, storedTrans) => {
        if (err) { return done(err) }
        ctx.request = storedTrans.request
        ctx.request.header = {}
        ctx.transactionId = storedTrans._id
        ctx.request.header['X-OpenHIM-TransactionID'] = storedTrans._id
        messageStore.storeResponse(ctx, err2 =>
          messageStore.storeNonPrimaryResponse(ctx, ctx.routes[0], () =>
            messageStore.storeNonPrimaryResponse(ctx, ctx.routes[1], () =>
              messageStore.setFinalStatus(ctx, () => {
                should.not.exist(err2)
                return TransactionModel.findOne({ _id: storedTrans._id }, (err3, trans) => {
                  should.not.exist(err3);
                  (trans !== null).should.be.true()
                  trans.status.should.be.exactly('Completed')
                  return done()
                })
              })
            )
          )
        )
      })
    })

    it('should set the status to completed if any other response code is recieved on secondary routes', (done) => {
      ctx.response = createResponse(200)
      ctx.routes = []
      ctx.routes.push(createRoute('route1', 302))
      ctx.routes.push(createRoute('route2', 200))

      messageStore.storeTransaction(ctx, (err, storedTrans) => {
        if (err) { return done(err) }
        ctx.request = storedTrans.request
        ctx.request.header = {}
        ctx.transactionId = storedTrans._id
        ctx.request.header['X-OpenHIM-TransactionID'] = storedTrans._id
        messageStore.storeResponse(ctx, err2 =>
          messageStore.storeNonPrimaryResponse(ctx, ctx.routes[0], () =>
            messageStore.storeNonPrimaryResponse(ctx, ctx.routes[1], () =>
              messageStore.setFinalStatus(ctx, () => {
                should.not.exist(err2)
                return TransactionModel.findOne({ _id: storedTrans._id }, (err3, trans) => {
                  should.not.exist(err3);
                  (trans !== null).should.be.true()
                  trans.status.should.be.exactly('Completed')
                  return done()
                })
              })
            )
          )
        )
      })
    })

    const createResponseWithReservedChars = status =>
      ({
        status,
        header: {
          'dot.header': '123',
          dollar$header: '124'
        },
        body: Buffer.from('<HTTP response body>'),
        timestamp: new Date()
      })

    it('should be able to save the response if the headers contain Mongo reserved characters ($ or .)', (done) => {
      ctx.response = createResponseWithReservedChars(200)

      messageStore.storeTransaction(ctx, (err, storedTrans) => {
        if (err) { return done(err) }
        ctx.transactionId = storedTrans._id
        messageStore.storeResponse(ctx, (err2) => {
          should.not.exist(err2)
          return TransactionModel.findOne({ _id: storedTrans._id }, (err3, trans) => {
            should.not.exist(err3);
            (trans !== null).should.be.true()
            trans.response.headers['dot．header'].should.equal('123')
            trans.response.headers['dollar＄header'].should.equal('124')
            return done()
          })
        })
      })
    })

    it('should remove the request body if set in channel settings and save to the DB', (done) => {
      ctx.authorisedChannel.requestBody = false

      messageStore.storeTransaction(ctx, (error, result) => {
        should.not.exist(error)
        return TransactionModel.findOne({ _id: result._id }, (error, trans) => {
          should.not.exist(error);
          (trans !== null).should.be.true()
          trans.clientID.toString().should.equal('313233343536373839319999')
          trans.channelID.toString().should.equal(channel1._id.toString())
          trans.status.should.equal('Processing')
          trans.request.body.should.equal('')
          trans.canRerun.should.equal(false)
          return done()
        })
      })
    })

    it('should update the transaction with the response and remove the response body', (done) => {
      ctx.response = createResponse(201)

      ctx.authorisedChannel.responseBody = false

      messageStore.storeTransaction(ctx, (err, storedTrans) => {
        if (err) { return done(err) }
        ctx.transactionId = storedTrans._id
        messageStore.storeResponse(ctx, (err2) => {
          should.not.exist(err2)
          return TransactionModel.findOne({ _id: storedTrans._id }, (err3, trans) => {
            should.not.exist(err3);
            (trans !== null).should.be.true()
            trans.response.status.should.equal(201)
            trans.response.body.should.equal('')
            return done()
          })
        })
      })
    })

    it('should truncate the response body if it exceeds storage limits', (done) => {
      ctx.response = createResponse(201)
      ctx.response.body = ''
      for (let i = 0, end = 2000 * 1024, asc = end >= 0; asc ? i < end : i > end; asc ? i++ : i--) {
        ctx.response.body += '1234567890'
      }

      messageStore.storeTransaction(ctx, (err, storedTrans) => {
        if (err) { return done(err) }
        ctx.transactionId = storedTrans._id
        messageStore.storeResponse(ctx, (err2) => {
          should.not.exist(err2)
          messageStore.setFinalStatus(ctx, () =>
            TransactionModel.findOne({ _id: storedTrans._id }, (err3, trans) => {
              should.not.exist(err3);
              (trans !== null).should.be.true()
              const expectedLen = utils.MAX_BODIES_SIZE - ctx.body.length
              trans.response.body.length.should.be.exactly(expectedLen)
              return done()
            })
          )
        })
      })
    })

    it('should truncate the response body for orchestrations if it exceeds storage limits', (done) => {
      ctx.response = createResponse(201)
      ctx.mediatorResponse = {
        orchestrations: [{
          name: 'orch1',
          request: {
            host: 'localhost',
            port: '4466',
            path: '/test',
            body: 'orch body',
            timestamp: new Date()
          },
          response: {
            status: 201,
            timestamp: new Date()
          }
        },
        {
          name: 'orch2',
          request: {
            host: 'localhost',
            port: '4466',
            path: '/test',
            timestamp: new Date()
          },
          response: {
            status: 200,
            headers: {
              test: 'test'
            },
            timestamp: new Date()
          }
        }
        ]
      }
      for (let i = 0, end = 2000 * 1024, asc = end >= 0; asc ? i < end : i > end; asc ? i++ : i--) {
        ctx.mediatorResponse.orchestrations[1].response.body += '1234567890'
      }

      messageStore.storeTransaction(ctx, (err, storedTrans) => {
        if (err) { return done(err) }
        ctx.transactionId = storedTrans._id
        messageStore.storeResponse(ctx, (err2) => {
          should.not.exist(err2)
          messageStore.setFinalStatus(ctx, () =>
            TransactionModel.findOne({ _id: storedTrans._id }, (err3, trans) => {
              should.not.exist(err3);
              (trans !== null).should.be.true()
              const expectedLen = utils.MAX_BODIES_SIZE - ctx.body.length - ctx.response.body.length -
                ctx.mediatorResponse.orchestrations[0].request.body.length
              trans.orchestrations[1].response.body.length.should.be.exactly(expectedLen)
              return done()
            })
          )
        })
      })
    })

    return it('should truncate the response body for routes if they exceed storage limits', (done) => {
      ctx.response = createResponse(201)
      ctx.routes = []
      ctx.routes.push(createRoute('route1', 201))
      ctx.routes.push(createRoute('route2', 200))
      for (let i = 0, end = 2000 * 1024, asc = end >= 0; asc ? i < end : i > end; asc ? i++ : i--) {
        ctx.routes[1].response.body += '1234567890'
      }

      messageStore.storeTransaction(ctx, (err, storedTrans) => {
        if (err) { return done(err) }
        ctx.transactionId = storedTrans._id
        messageStore.storeResponse(ctx, err2 =>
          messageStore.storeNonPrimaryResponse(ctx, ctx.routes[0], () =>
            messageStore.storeNonPrimaryResponse(ctx, ctx.routes[1], () =>
              messageStore.setFinalStatus(ctx, () =>
                TransactionModel.findOne({ _id: storedTrans._id }, (err3, trans) => {
                  should.not.exist(err3);
                  (trans !== null).should.be.true()
                  const expectedLen = utils.MAX_BODIES_SIZE - ctx.body.length - ctx.response.body.length -
                    ctx.routes[0].response.body.length
                  trans.routes[1].response.body.length.should.be.exactly(expectedLen)
                  return done()
                })
              )
            )
          )
        )
      })
    })
  })
})
