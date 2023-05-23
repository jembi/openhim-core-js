'use strict'

/* eslint-env mocha */

import sinon from 'sinon'
import logger from 'winston'
import {KafkaProducer} from '../../src/kafkaProducer'

describe('Kafka Producer Test', () => {
  describe('connect', () => {
    it('should call connect on the kafka producer and set isConnected to true', async () => {
      const producer = new KafkaProducer('test', 60000)
      producer._producer.connect = sinon.stub()

      await producer.connect()

      producer.isConnected.should.be.true
      producer.producer.connect.called.should.be.true
    })
  })

  describe('disconnect', () => {
    it('should call disconnect on the kafka producer and set isConnected to false', async () => {
      const producer = new KafkaProducer('test', 60000)
      producer._producer.connect = sinon.stub()
      producer._producer.disconnect = sinon.stub()
      await producer.connect()
      producer.isConnected.should.be.true

      await producer.disconnect()

      producer.isConnected.should.be.false
      producer.producer.connect.called.should.be.false
    })

    it('should log when disconnect throws and not update connected', async () => {
      const loggerSpy = sinon.spy(logger, 'error')
      const producer = new KafkaProducer('test', 60000)
      producer._producer.disconnect = sinon
        .stub()
        .returns(Promise.reject(new Error('bad test')))
      producer._producer.connect = sinon.stub()
      await producer.connect()
      producer.isConnected.should.be.true

      await producer.disconnect()

      producer.isConnected.should.be.true
      loggerSpy.calledOnce.should.be.true
      loggerSpy.restore()
    })
  })
})
