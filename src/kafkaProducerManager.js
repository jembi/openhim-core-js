import {KafkaProducer} from './kafkaProducer.js'

export class KafkaProducerManager {
  static kafkaSet = {}

  static async getProducer(channelName, clientId, timeout) {
    const kafkaInstance = this.findOrAddConnection(
      channelName,
      clientId,
      timeout
    )
    if (!kafkaInstance.isConnected) await kafkaInstance.connect()

    return kafkaInstance.producer
  }

  static findOrAddConnection(channelName, clientId, timeout) {
    let kafkaInstance = this.getKafkaInstance(channelName, clientId, timeout)
    if (!kafkaInstance) {
      kafkaInstance = new KafkaProducer(clientId, timeout)
      this.kafkaSet[`urn:${channelName}:${clientId}:${timeout}`] = kafkaInstance
    }

    return kafkaInstance
  }

  static async removeConnection(channelName, clientId, timeout) {
    const kafkaInstance = this.getKafkaInstance(channelName, clientId, timeout)

    if (kafkaInstance) {
      if (kafkaInstance.isConnected) await kafkaInstance.disconnect()
      delete this.kafkaSet[`urn:${channelName}:${clientId}:${timeout}`]
    }
  }

  static getKafkaInstance(channelName, clientId, timeout) {
    return this.kafkaSet[`urn:${channelName}:${clientId}:${timeout}`]
  }
}
