require('babel-register')
const faker = require('faker')
const { ClientModel, ChannelModel, TransactionModel } = require('../src/model')
const { dropTestDb } = require('../test/utils')

async function seedValues(clients = 1, channelsPerClient = 1, transactionsPerChannel = 1000, seed = 90123) {
  await dropTestDb()
  faker.seed(seed)
  for (let clientNum = 0; clientNum < clients; clientNum++) {
    const client = await createClient(clientNum)
    for (let channelNum = 0; channelNum < channelsPerClient; channelNum++) {
      const channel = await creatChannel(client, channelNum)
      for (let transactionNum = 0; transactionNum < transactionsPerChannel; transactionNum++) {
        await createTransaction(channel, client, transactionNum)
      }
    }
  }
}

async function createClient(clientNum) {
  const contactPerson = {
    firstName: faker.name.firstName(),
    lastName: faker.name.lastName()
  }
  // password = 'password'
  const client = new ClientModel({
    clientID: `testClient${clientNum}`,
    name: `testClient${clientNum}`,
    roles: [`role${clientNum}`],
    passwordAlgorithm: 'sha512',
    passwordHash: '52a0bbed619cccf9cc7e7001d9c7cd4034d031560254899f698189f1441c92933e4231d7594b532247b54b327c518f7967894013568dbce129738362ad4b09e3​​​​​',
    passwordSalt: '8b9fc31b-1a2a-4453-94e2-00ce54be04e6',
    organization: faker.company.companyName(),
    location: faker.address.city(),
    softwareName: faker.commerce.product(),
    description: faker.commerce.productName(),
    contactPerson: `${contactPerson.firstName} ${contactPerson.lastName}`,
    contactPersonEmail: faker.internet.email(contactPerson.firstName, contactPerson.lastName)
  })

  return client.save()
}

async function creatChannel(client, channelNum) {
  const httpMethods = ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS', 'HEAD', 'TRACE', 'CONNECT', 'PATCH']
  const routeDef = {
    name: faker.name.findName(),
    host: 'http//localhost:8080',
    port: 3441,
    primary: true,
    type: 'http'
  }

  const channel = new ChannelModel({
    name: `testChannel${channelNum}`,
    urlPattern: '/encounters/.*$',
    routes: routeDef,
    type: 'http',
    allow: [`${client.name}`],
    methods: httpMethods,
    addAutoRewriteRules: true,
    __v: 1
  })

  return channel.save()
}

if (module.parent == null) {
  // Do seed off of argv
  seedValues()
}