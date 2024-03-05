'use strict'

/* eslint-env mocha */
import should from 'should'
import {ImportMapModel, setupAppChangeStream} from '../../src/model/importMap'
import sinon from 'sinon'
import {AppModel} from '../../src/model/apps'

describe('setupAppChangeStream', () => {
  let appModelWatchStub
  let importMapModelStub
  let consoleLogStub

  beforeEach(() => {
    appModelWatchStub = sinon.stub(AppModel, 'watch').returns({
      on: sinon.stub()
    })

    importMapModelStub = sinon.stub(ImportMapModel)
  })

  afterEach(() => {
    appModelWatchStub.restore()
    importMapModelStub.restore()
    consoleLogStub.restore()
  })

  it('should call AppModel.watch', () => {
    setupAppChangeStream()
    should.exist(appModelWatchStub.calledOnce)
  })

  it('should update ImportMapModel on insert operation', async () => {
    const change = {
      operationType: 'insert',
      fullDocument: {_id: 'id', name: 'name', url: 'url'}
    }

    setupAppChangeStream()
    const changeCallback = appModelWatchStub.firstCall.args[0]

    await changeCallback(change)

    importMapModelStub.updateOne.calledWith(
      {appId: 'id', name: 'name'},
      {url: 'url'},
      {upsert: true}
    ).should.be.true
  })

  it('should update ImportMapModel on update operation', async () => {
    const change = {
      operationType: 'update',
      fullDocument: {_id: 'id', name: 'name', url: 'url'}
    }

    setupAppChangeStream()
    const changeCallback = appModelWatchStub.firstCall.args[0]

    await changeCallback(change)

    importMapModelStub.updateOne.calledWith(
      {appId: 'id', name: 'name'},
      {url: 'url'}
    ).should.be.true
  })

  it('should delete from ImportMapModel on delete operation', async () => {
    const change = {operationType: 'delete', documentKey: {_id: 'id'}}

    setupAppChangeStream()
    const changeCallback = appModelWatchStub.firstCall.args[0]

    await changeCallback(change)

    importMapModelStub.deleteOne.calledWith({appId: 'id'}).should.be.true
  })

  it('should log unsupported operation type', async () => {
    const change = {operationType: 'unsupported'}

    setupAppChangeStream()
    const changeCallback = appModelWatchStub.firstCall.args[0]

    await changeCallback(change)

    consoleLogStub.calledWith('Unsupported operation type:', 'unsupported')
      .should.be.true
  })
})
