require('babel-register')
const { ClientModel, ChannelModel, TransactionModel, UserModel } = require('../src/model')
const { dropTestDb, rootUser } = require('../test/utils')
const Progress = require('progress')
const faker = require('faker')
const { ObjectId } = require('mongodb')

const DEFAULT_SEED = 9575
const IS_QUIET = process.argv.indexOf('--quiet') !== -1 || process.argv.indexOf('-q') !== -1

const DEFAULT_START_DATE = new Date('2016/11/12')
const DEFAULT_END_DATE = new Date('2017/12/30')

let bar

function tickProgress (tickAmount) {
  if (bar == null) {
    return
  }

  bar.tick(tickAmount)
}

function getTransactionCount () {
  let tranIndex = process.argv.indexOf('--tran')
  if (tranIndex === -1) {
    tranIndex = process.argv.indexOf('-t')
  }
  if (tranIndex === -1 && process.argv.length >= tranIndex + 1) {
    return
  }

  const trans = parseInt(process.argv[tranIndex + 1], 10)
  return isNaN(trans) ? undefined : trans
}

async function seedValues (clients = 1, channelsPerClient = 2, transactionsPerChannel = 250000, startDate = DEFAULT_START_DATE, endDate = DEFAULT_END_DATE) {
  const totalTrans = clients * channelsPerClient * transactionsPerChannel
  console.log(`Starting seed of ${totalTrans} transactions`)
  await dropTestDb()
  if (!IS_QUIET) {
    bar = new Progress('Seeding Transactions [:bar] :rate/trans per sec :percent :etas', {
      total: totalTrans
    })
  }
  faker.seed(DEFAULT_SEED)
  const user = await new UserModel(rootUser).save()
  const timeStep = Math.floor((endDate.getTime() - startDate.getTime()) / transactionsPerChannel)
  // This could be done better with something like rxjs but it might make it needlessly complicated
  for (let clientNum = 0; clientNum < clients; clientNum++) {
    const client = await createClient(clientNum)
    for (let channelNum = 0; channelNum < channelsPerClient; channelNum++) {
      const channel = await creatChannel(client, channelNum, user)
      const transactions = []
      const flushTrans = async () => {
        tickProgress(transactions.length)
        await TransactionModel.bulkWrite(transactions.map(t => ({ insertOne: { document: t } })))
        transactions.length = 0
      }
      for (let transactionNum = 0; transactionNum < transactionsPerChannel; transactionNum++) {
        const requestTime = new Date(startDate.getTime() + timeStep * transactionNum)
        transactions.push(createTransactionDoc(channel, client, requestTime))
        if (transactions.length > 1000) {
          await flushTrans()
        }
      }
      if (transactions.length > 0) {
        await flushTrans()
      }
    }
  }
  console.log(`completed seed`)
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

async function creatChannel (client, channelNum, user) {
  const routeDef = {
    name: faker.name.findName(),
    host: 'localhost',
    port: 3441,
    primary: true,
    type: 'http'
  }

  const id = `0`.repeat(12 - channelNum.toString().length) + channelNum

  const channel = new ChannelModel({
    _id: new ObjectId(id),
    name: `channel${channelNum}`,
    urlPattern: `/channel${channelNum}/.*$`,
    routes: routeDef,
    type: 'http',
    allow: [`${client.name}`],
    methods: ['POST', 'GET', 'PUT', 'DELETE'],
    addAutoRewriteRules: true,
    updatedBy: {
      id: user._id,
      name: user.email
    }
  })

  return channel.save()
}

function createTransactionDoc (channel, client, requestTime) {
  const request = {
    host: faker.internet.ip(),
    port: channel.port,
    path: `/${channel.name}`,
    headers: {
      'Content-type': 'text/html'
    },
    method: oneOf(['POST', 'GET', 'PUT', 'DELETE']),
    timestamp: requestTime
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
      timestamp: new Date(requestTime.getTime() + faker.random.number({ min: 30, max: 1200 }))
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

  return transactionDoc
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
  switch (faker.random.number() % 6) {
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
  seedValues(undefined, undefined, getTransactionCount())
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}
