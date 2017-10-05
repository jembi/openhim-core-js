/* eslint-env mocha */

import * as metadata from '../../src/api/metadata'

describe('Metadata Functions', () => {
  describe('.removeProperties', () =>

    it('should return an object with _id and __v removed from all objects in the object', (done) => {
      const object = {
        _id: '11111',
        __v: 'test',
        someProp: 'hello',
        innerObj: {
          _id: '11111',
          __v: 'test',
          someOtherProp: 'hello'
        }
      }
      const result = metadata.removeProperties(object)
      result.should.have.property('someProp', 'hello')
      result.should.have.property('innerObj', {someOtherProp: 'hello'})
      result.should.not.have.property('_id', '11111')
      result.should.not.have.property('__v', 'test')
      return done()
    })
  )

  describe('.getUniqueIdentifierForCollection', () =>

    it('should return objects with the collection\'s unique attribute and the respective value', (done) => {
      let result = metadata.getUniqueIdentifierForCollection('Channels', {name: 'channelUID'})
      result.should.have.property('name', 'channelUID')

      result = metadata.getUniqueIdentifierForCollection('Clients', {clientID: 'clientUID'})
      result.should.have.property('clientID', 'clientUID')

      result = metadata.getUniqueIdentifierForCollection('Mediators', {urn: 'mediatorUID'})
      result.should.have.property('urn', 'mediatorUID')

      result = metadata.getUniqueIdentifierForCollection('Users', {email: 'userUID'})
      result.should.have.property('email', 'userUID')

      result = metadata.getUniqueIdentifierForCollection('ContactGroups', {groups: 'cgUID'})
      result.should.have.property('groups', 'cgUID')
      return done()
    })
  )

  describe('.buildResponseObject', () =>

    it('build a response object', (done) => {
      const model = 'Channels'
      const doc = {
        name: 'Channel1',
        urlPattern: 'test/sample'
      }
      const status = 'Valid'
      const message = ''
      const uid = 'Channel1'

      const result = metadata.buildResponseObject(model, doc, status, message, uid)
      result.should.have.property('model', 'Channels')
      result.should.have.property('record', {name: 'Channel1', urlPattern: 'test/sample'})
      result.should.have.property('status', 'Valid')
      result.should.have.property('message', '')
      result.should.have.property('uid', 'Channel1')
      return done()
    })
  )
})
