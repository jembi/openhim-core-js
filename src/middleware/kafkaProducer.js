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
  _options = {}
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

      this._options = {
        brokers,
        clientId,
        timeout
      }

      this._producer = kafka.producer()

      this._producer.on(this._producer.events.DISCONNECT, () => {
        this._isConnected = false
      })
    }
  }

  get options() {
    return this._options
  }

  get isConnected() {
    return this._isConnected
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

  get producer() {
    return this._producer
  }
}
