require('babel-register')
const faker = require('faker')
const { ClientModel, ChannelModel, TransactionModel } = require('../src/model')
const { dropTestDb } = require('../test/utils')

const DEFAULT_SEED = 9575

const DEFAULT_START_DATE = new Date('2015/11/12')
const DEFAULT_END_DATE = new Date('2018/11/12')

async function seedValues (clients = 1, channelsPerClient = 1, transactionsPerChannel = 1000, startDate = DEFAULT_START_DATE, endDate = DEFAULT_END_DATE) {
  await dropTestDb()
  faker.seed(DEFAULT_SEED)
  const timeStep = Math.floor((endDate.getTime() - startDate.getTime()) / transactionsPerChannel)
  // TODO : Make this a lot faster
  for (let clientNum = 0; clientNum < clients; clientNum++) {
    const client = await createClient(clientNum)
    for (let channelNum = 0; channelNum < channelsPerClient; channelNum++) {
      const channel = await creatChannel(client, channelNum)
      for (let transactionNum = 0; transactionNum < transactionsPerChannel; transactionNum++) {
        const requestTime = new Date(startDate.getTime() + timeStep * transactionNum)
        await createTransaction(channel, client, requestTime)
      }
    }
  }
}

async function createClient (clientNum) {
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

function creatChannel (client, channelNum) {
  // const channel = new ChannelModel({
  //   name :
  // })
}

function createTransaction (channel, client, requestTime) {
  const request = {
    host: faker.internet.ip(),
    port: channel.port,
    path: 'test/path',
    headers: {
      'Content-type': 'text/html'
    },
    method: oneOf(['POST', 'GET', 'PUT', 'DELETE']),
    timestamp: new Date()
  }

  const transactionDoc = {
    clientID: client._id,
    clientIP: faker.internet.ip(),
    channelID: channel._id,
    request,
    status: oneOf(['Processing', 'Failed', 'Completed', 'Successful', 'Completed with error(s)'])
  }

  if (transactionDoc.status !== 'Processing') {
    const response = {
      status: getStatusCode(transactionDoc.status),
      headers: {
        'Content-type': 'text/html'
      },
      timestamp: new Date()
    }

    if (response.status >= 500) {
      response.error = {
        message: 'Something failed'
      }
    } else {
      response.body = getBody()
    }

    Object.assign(transactionDoc, { response })
  }

  return new TransactionModel(transactionDoc).save()
}

function getStatusCode (status) {
  switch (status) {
    case 'Failed': return 500
    case 'Completed': return 400
    case 'Successful': return 201
    default: return 200
  }
}

function getBody () {
  switch (faker.random() % 6) {
    case 0: return Buffer.alloc(100000, 'Large Response ').toString()
    case 1:
    case 2:
    case 3: return `Response Body`
    default: return ''
  }
}

function oneOf (arr) {
  return arr[faker.random.number() % arr.length]
}

if (module.parent == null) {
  // Do seed off of argv
  seedValues()
}
