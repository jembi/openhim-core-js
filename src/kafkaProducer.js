import logger from 'winston'
import {Kafka, logLevel} from 'kafkajs'
import {config} from './config'

config.router = config.get('router')

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
  _producer = null
  _isConnected = false

  constructor(clientId, timeout) {
    if (clientId) {
      let brokers = config.router.kafkaBrokers
      brokers = brokers.replace(/"/g, '').split(',')

      const kafka = new Kafka({
        brokers: brokers,
        clientId: clientId,
        requestTimeout: timeout,
        connectionTimeout: timeout,
        logLevel: logLevel.DEBUG,
        logCreator: kafkaLogger
      })

      this._producer = kafka.producer()

      this._producer.on(this._producer.events.DISCONNECT, () => {
        this._isConnected = false
      })
    }
  }

  get isConnected() {
    return this._isConnected
  }

  get producer() {
    return this._producer
  }

  async connect() {
    // Not catching the error to throw the original error message
    await this._producer.connect()
    this._isConnected = true
  }

  async disconnect() {
    try {
      await this._producer.disconnect()
      this._isConnected = false
    } catch (err) {
      logger.error(err.message)
    }
  }
}
