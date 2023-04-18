import {KafkaProducer} from './kafkaProducer.js'

export class KafkaProducerManager {
  static kafkaSet = {}

  static async getProducer(details, timeout) {
    const kafkaInstance = this.findOrAddConnection(details, timeout)
    if (!kafkaInstance.isConnected) await kafkaInstance.connect()
    if (!kafkaInstance.isConnected) throw new Error('Kafka Producer failed to connect.')

    return kafkaInstance.producer
  }

  static findOrAddConnection(details, timeout) {
    let kafkaInstance = this.getKafkaInstance(details, timeout)
    if (!kafkaInstance) {
      const {kafkaBrokers, kafkaClientId} = details
      kafkaInstance = new KafkaProducer(kafkaBrokers, kafkaClientId, timeout)
      this.kafkaSet[`${kafkaBrokers}${kafkaClientId}${timeout}`] = kafkaInstance
    }

    return kafkaInstance;
  }

  static async removeConnection(details, timeout) {
    const kafkaInstance = this.getKafkaInstance(details, timeout)

    if (kafkaInstance && kafkaInstance.isConnected) await kafkaInstance.disconnect()
  }

  static getKafkaInstance(details, timeout) {
    const {kafkaBrokers, kafkaClientId} = details

    return this.kafkaSet[`${kafkaBrokers}${kafkaClientId}${timeout}`]
  }
}
