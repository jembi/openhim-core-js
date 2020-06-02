'use strict'

/* eslint-env mocha */

import fs from 'fs'
import should from 'should'
import sinon from 'sinon'

import * as configIndex from '../../src/config'
import * as cache from '../../src/jwtSecretOrPublicKeyCache'

describe('JWT Cache Test', () => {
  describe('populate cache', () => {
    let sandbox = sinon.createSandbox()

    before(() => {
      cache.clearSecretOrPublicKey()
    })

    afterEach(() => {
      cache.clearSecretOrPublicKey()
      sandbox.restore()
    })

    it('should fail when Public key file read errors', () => {
      const secretOrPublicKey = 'jwtecdsa256.pem'

      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .returns(secretOrPublicKey)

      const fsExistsSyncStub = sandbox.stub(fs, 'existsSync').returns(true)

      const fsIsFileStub = sandbox.stub(fs, 'lstatSync').returns({
        isFile: () => {
          return true
        }
      })

      const fsReadFileSyncStub = sandbox
        .stub(fs, 'readFileSync')
        .throws(new Error('Boom!'))

      try {
        cache.populateCache()
      } catch (error) {
        should(error.message).equal('Could not read JWT public key file: Boom!')
      }
      configStub.callCount.should.eql(1)
      fsExistsSyncStub.callCount.should.eql(1)
      fsIsFileStub.callCount.should.eql(1)
      fsReadFileSyncStub.callCount.should.eql(1)
      should(cache.getSecretOrPublicKey()).be.null()
    })

    it('should succeed on file read', () => {
      const secretOrPublicKey = 'jwtecdsa256.pem'

      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .returns(secretOrPublicKey)

      const fsExistsSyncStub = sandbox.stub(fs, 'existsSync').returns(true)

      const fsIsFileStub = sandbox.stub(fs, 'lstatSync').returns({
        isFile: () => {
          return true
        }
      })

      const fsReadFileSyncStub = sandbox
        .stub(fs, 'readFileSync')
        .returns('test')

      should(cache.getSecretOrPublicKey()).be.null()

      cache.populateCache()

      configStub.callCount.should.eql(1)
      fsExistsSyncStub.callCount.should.eql(1)
      fsIsFileStub.callCount.should.eql(1)
      fsReadFileSyncStub.callCount.should.eql(1)
      should(cache.getSecretOrPublicKey()).equal('test')
    })

    it('should succeed when file does not exist', () => {
      const secretOrPublicKey = 'test'

      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .returns(secretOrPublicKey)

      const fsExistsSyncStub = sandbox.stub(fs, 'existsSync').returns(false)

      should(cache.getSecretOrPublicKey()).be.null()

      cache.populateCache()

      configStub.callCount.should.eql(1)
      fsExistsSyncStub.callCount.should.eql(1)
      should(cache.getSecretOrPublicKey()).equal('test')
    })

    it('should succeed when no value specified', () => {
      const secretOrPublicKey = ''

      const configStub = sandbox
        .stub(configIndex.config, 'get')
        .returns(secretOrPublicKey)

      const fsExistsSyncStub = sandbox.stub(fs, 'existsSync').returns(true)

      const fsIsFileStub = sandbox.stub(fs, 'lstatSync').returns({
        isFile: () => {
          return false
        }
      })

      cache.populateCache()

      configStub.callCount.should.eql(1)
      fsExistsSyncStub.callCount.should.eql(1)
      fsIsFileStub.callCount.should.eql(1)
      should(cache.getSecretOrPublicKey()).equal('')
    })
  })
})
