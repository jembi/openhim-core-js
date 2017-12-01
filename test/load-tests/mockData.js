
const utils = require('../utils')
const config = require('../config')
const faker = require('faker')

const baseUrl = 'http//localhost:8080/'

const headers = {
    Authorization: utils.getAuthBasicValue('root@openhim.org', 'admin')
}

async function fetchWrapper(url, options = {}) {
    if (options.body != null && typeof options.body !== 'string') {
        options.body = JSON.stringify(options.body)
        if (options.headers == null) {
            options.headers = {}
        }
    }
    const resp = await fetch(url, options)
    if (!resp.ok) {
        throw new Error(`Got a ${resp.status} when calling ${url}`)
    }
    return resp.json()
}

async function pushData(path, options = {}) {
    const queryOptions = Object.assign({}, { headers: headers }, options)
    const requestUrl = baseUrl + '/' + path + '.json'
    return await fetchWrapper(requestUrl, queryOptions)
}

async function loadMockClient() {
    const response = await pushData('/clients', {
        method: 'POST',
        body: {
            clientID: faker.name.firstName(),
            name: faker.name.firstName(),
            organisation: 'Organisation',
            softwareName: 'software name',
            description: 'description',
            location: faker.address.country(),
            contactPerson: faker.name.findName(),
            contactPersonEmail: faker.internet.email(),
            passwordAlgorithm: 'sha512',
            passwordSalt: 'ca29b0615945f9e057865ebf5687c097',
            passwordHash: '5035b5afc74406ee15be4b098f94f9c2aa63418e165c446e0a62f3a1cb35df6a09fd7f90acb4fa58f13f6f8d7f328b4f76ce98ae21fc2f760e3246198a3c313b'
        }
    })

}

async function loadChannels() {
    const response = await pushData('/clients', {
        method: 'POST',
        body: {
            requestBody: true,
            responseBody: true,
            name: 'Test Channel',
            urlPattern: '^/encounters/.*$',
            matchContentRegex: null,
            matchContentXpath: null,
            matchContentValue: null,
            matchContentJson: null,
            pollingSchedule: null,
            tcpHost: null,
            tcpPort: null,
            autoRetryPeriodMinutes: 60,
            autoRetryEnabled: false,
            rewriteUrlsConfig: [],
            addAutoRewriteRules: true,
            rewriteUrls: false,
            status: 'enabled',
            alerts: [],
            txRerunAcl: [],
            txViewFullAcl: [],
            txViewAcl: [],
            properties: [],
            matchContentTypes: [],
            routes: [
                {
                    name: 'Test Route',
                    secured: false,
                    host: 'localhost',
                    port: 3444,
                    path: '',
                    pathTransform: '',
                    primar: true,
                    username: '',
                    password: 'Tutorial',
                    forwardAuthHeader: false,
                    status: 'enabled',
                    type: 'http'
                }
            ]
        }
        
    })
}
