import {KafkaProducer} from './kafkaProducer.js'

export class KafkaProducerManager {
  static kafkaSet = {}

  static async getProducer(channelName, route, timeout) {
    const kafkaInstance = this.findOrAddConnection(channelName, route, timeout)
    if (!kafkaInstance.isConnected) await kafkaInstance.connect()
    if (!kafkaInstance.isConnected) throw new Error('Kafka Producer failed to connect.')

    return kafkaInstance.producer
  }

  static findOrAddConnection(channelName, route, timeout) {
    let kafkaInstance = this.getKafkaInstance(channelName, route, timeout)
    if (!kafkaInstance) {
      const {kafkaBrokers, kafkaClientId} = route
      kafkaInstance = new KafkaProducer(kafkaBrokers, kafkaClientId, timeout)
      this.kafkaSet[`${channelName}${kafkaClientId}${timeout}`] = kafkaInstance
    }

    return kafkaInstance;
  }

  static async removeConnection(channelName, route, timeout) {
    const kafkaInstance = this.getKafkaInstance(channelName, route, timeout)

    if (kafkaInstance) {
      if (kafkaInstance.isConnected) await kafkaInstance.disconnect()
  
      const {kafkaBrokers, kafkaClientId} = route
      delete this.kafkaSet[`${channelName}${kafkaClientId}${timeout}`]
    }
  }

  static getKafkaInstance(channelName, route, timeout) {
    const {kafkaBrokers, kafkaClientId} = route

    return this.kafkaSet[`${channelName}${kafkaClientId}${timeout}`]
  }
}
