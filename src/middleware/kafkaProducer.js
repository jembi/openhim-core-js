import logger from 'winston'
import {Kafka, logLevel} from 'kafkajs'

// Customize Kafka logs
function kafkaLogger() {
  const toWinstonLogLevel = level => {
    switch (level) {
      case logLevel.ERROR:
      case logLevel.NOTHING:
        return 'error'
      case logLevel.WARN:
        return 'warn'
      case logLevel.INFO:
        return 'info'
      case logLevel.DEBUG:
        return 'debug'
    }
  }
  return ({level, log}) => {
    const {message, ...extra} = log
    logger[toWinstonLogLevel(level)]({
      message,
      extra
    })
  }
}

export class KafkaProducer {
  static details = {}
  _producer = null
  _isConnected = false

  constructor(brokers, clientId, timeout) {
    if (brokers && clientId) {
      const kafkaBrokers = brokers.replace(/"/g, '').split(',')

      const kafka = new Kafka({
        brokers: kafkaBrokers,
        clientId: clientId,
        requestTimeout: timeout,
        connectionTimeout: timeout,
        logLevel: logLevel.DEBUG,
        logCreator: kafkaLogger
      })

      KafkaProducer.details = {
        kafkaBrokers: brokers,
        kafkaClientId: clientId,
        timeout: timeout
      }

      this._producer = kafka.producer()

      this._producer.on(this._producer.events.DISCONNECT, () => {
        this._isConnected = false
      })
    }
  }

  get getDetails() {
    return KafkaProducer.details
  }

  get isConnected() {
    return this._isConnected
  }

  async connect() {
    await this._producer.connect()
    this._isConnected = true
  }

  async disconnect() {
    await this._producer.disconnect()
    this._isConnected = false
  }

  get producer() {
    return this._producer
  }
}
