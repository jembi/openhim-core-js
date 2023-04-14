import logger from 'winston'

import {KafkaProducer} from './kafkaProducer.js'

export class KafkaProducerManager {
  static kafkaSet = {}

  static async getProducer(details) {
    const kafkaInstance = this.getKafkaInstance(details)

    if (kafkaInstance) {
      if (!kafkaInstance.isConnected) {
        await kafkaInstance.connect()
      }

      if (!kafkaInstance.isConnected) {
        throw new Error('Kafka Producer failed to connect.')
      }
      return kafkaInstance.producer
    } else {
      logger.error('Unknown kafka details')
    }
  }

  static findOrAddConnection(details) {
    const kafkaInstance = this.getKafkaInstance(details)

    const {brokers, clientId, timeout} = details

    if (!kafkaInstance) {
      const newKafka = new KafkaProducer(brokers, clientId, timeout)

      this.kafkaSet[`${brokers}${clientId}${timeout}`] = newKafka
    }
  }

  static async removeConnection(details) {
    const kafkaInstance = kafkaInstance(details)

    if (kafkaInstance) {
      await kafkaInstance.disconnect()
    }
  }

  static getKafkaInstance(details) {
    const {brokers, clientId, timeout} = details

    return this.kafkaSet[`${brokers}${clientId}${timeout}`]
  }
}
