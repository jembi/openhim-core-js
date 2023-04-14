import logger from 'winston'

import {KafkaProducer} from './kafkaProducer.js'

export class KafkaProducerSet {
  static kafkaSet = []

  static findKafkaInstance(details) {
    return KafkaProducerSet.kafkaSet.find(kafka => {
      return (
        details.kafkaBrokers === kafka.getDetails.kafkaBrokers &&
        details.kafkaClientId === kafka.getDetails.kafkaClientId &&
        details.timeout == kafka.getDetails.timeout
      )
    })
  }

  static async getProducer(details) {
    const kafkaExist = this.findKafkaInstance(details)

    if (kafkaExist) {
      if (!kafkaExist.isConnected) {
        await kafkaExist.connect()
      }
      return kafkaExist.producer
    } else {
      logger.error('Unknown kafka details')
    }
  }

  static async findOrAddConnection(details) {
    const kafkaExist = this.findKafkaInstance(details)

    if (!kafkaExist) {
      const newKafka = new KafkaProducer(
        details.kafkaBrokers,
        details.kafkaClientId,
        details.timeout
      )
      KafkaProducerSet.kafkaSet.push(newKafka)
      await newKafka.connect()
    }
  }

  static async removeConnection(details) {
    const index = KafkaProducerSet.kafkaSet.findIndex(
      kafka =>
        details.kafkaBrokers === kafka.getDetails.kafkaBrokers &&
        details.kafkaClientId === kafka.getDetails.kafkaClientId &&
        details.timeout === kafka.getDetails.timeout
    )
    if (index !== -1) {
      const KafkaInstance = KafkaProducerSet.kafkaSet[index]
      await KafkaInstance.disconnect()
    }
  }
}
