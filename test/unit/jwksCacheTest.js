'use strict'

/* eslint-env mocha */

// Import the necessary modules
import should from 'should'
import sinon from 'sinon'
import proxyquire from 'proxyquire'

// Create a Sinon stub for JwksRsa
const JwksRsaStub = sinon.stub()

// Stub the 'getSigningKeys' method
const getSigningKeysStub = sinon.stub()
JwksRsaStub.returns({getSigningKeys: getSigningKeysStub})

// Stub the 'config' module
const configStub = {
  config: {
    get: sinon.stub().returns('http://example.com/jwks')
  }
}

// Use proxyquire to require the module under test, replacing the default export with your stub
const {populateCache, getKey} = proxyquire('../../src/jwksCache', {
  'jwks-rsa': JwksRsaStub,
  './config': configStub
})

describe('JWKS Cache Test', () => {
  beforeEach(() => {
    // Reset the stubs before each test
    JwksRsaStub.resetHistory()
    getSigningKeysStub.resetHistory()
    configStub.config.get.resetHistory()
  })

  describe('populateCache', () => {
    it('should populate the cache', async () => {
      const keys = [{kid: 'key1'}, {kid: 'key2'}]
      getSigningKeysStub.resolves(keys)
      await populateCache()

      JwksRsaStub.calledOnce.should.be.true()
      getSigningKeysStub.calledOnce.should.be.true()
      configStub.config.get
        .calledWith('authentication:jwt:jwksUri')
        .should.be.true()
    })
  })

  describe('getKey', () => {
    it('should return the key if it exists in the cache', async () => {
      const keys = [{kid: 'key1'}, {kid: 'key2'}]
      getSigningKeysStub.resolves(keys)

      await populateCache()
      const key = await getKey('key1')

      key.should.deepEqual({kid: 'key1'})
    })

    it('should populate the cache and return the key if it does not exist in the cache', async () => {
      const keys = [{kid: 'key1'}, {kid: 'key2'}]
      getSigningKeysStub.onCall(0).resolves(keys)
      getSigningKeysStub.onCall(1).resolves(keys.concat({kid: 'key3'}))

      await populateCache()
      const key = await getKey('key3')

      JwksRsaStub.calledTwice.should.be.true()
      getSigningKeysStub.calledTwice.should.be.true()
      configStub.config.get.calledTwice.should.be.true()
      should(key).deepEqual({kid: 'key3'})
    })
  })
})
