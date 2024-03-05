'use strict'

/* eslint-env mocha */
import should from 'should'
import {ImportMapModel, setupAppChangeStream} from '../../src/model/importMap'
import sinon from 'sinon'
import {AppModel} from '../../src/model/apps'

describe('setupAppChangeStream', () => {
  let appModelWatchStub
  let importMapModelStub

  beforeEach(() => {
    appModelWatchStub = sinon.stub(AppModel, 'watch').returns({
      on: sinon.stub()
    })

    importMapModelStub = sinon.stub(ImportMapModel)
  })

  afterEach(() => {
    appModelWatchStub.restore()
    importMapModelStub.restore()
  })

  it('should call AppModel.watch', () => {
    setupAppChangeStream()
    should.exist(appModelWatchStub.calledOnce)
  })
})
