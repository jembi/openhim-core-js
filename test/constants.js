export const PORT_START = parseInt(process.env.TEST_PORT, 10) || 32000
export const UDP_PORT = PORT_START + 1
export const TCP_PORT = PORT_START + 2
export const TLS_PORT = PORT_START + 3
export const HTTP_PORT = PORT_START + 4
export const AUDIT_PORT = PORT_START + 5
export const STATIC_PORT = PORT_START + 6
export const HTTPS_PORT = PORT_START + 7
export const MEDIATOR_PORT = PORT_START + 8

export const DEFAULT_STATUS = 201

const SERVER_PORT_START = PORT_START + 20
export const SERVER_PORTS = Object.freeze({
  httpPort: SERVER_PORT_START,
  httpsPort: SERVER_PORT_START + 1,
  apiPort: SERVER_PORT_START + 2,
  rerunPort: SERVER_PORT_START + 3,
  tcpHttpReceiverPort: SERVER_PORT_START + 4,
  pollingPort: SERVER_PORT_START + 5,
  auditUDPPort: SERVER_PORT_START + 6,
  auditTlsPort: SERVER_PORT_START + 7,
  auditTcpPort: SERVER_PORT_START + 8
})

export const BASE_URL = `https://localhost:${SERVER_PORTS.apiPort}`
export const HTTP_BASE_URL = `http://localhost:${SERVER_PORTS.httpPort}`

export const UPD_SOCKET_TYPE = 'udp4'
export const DEFAULT_HTTP_RESP = 'Mock response body\n'
export const DEFAULT_HTTPS_RESP = 'Secured Mock response body\n'
export const DEFAULT_STATIC_PATH = 'test/resources'

export const MEDIATOR_HEADERS = { 'Content-Type': 'application/json+openhim; charset=utf-8' }
export const DEFAULT_HEADERS = { 'Content-Type': 'text/plain' }
export const MEDIATOR_REPONSE = Object.freeze({
  status: 'Successful',
  response: {
    status: 201,
    headers: {},
    body: 'Mock response body\n'
  },
  orchestrations: {
    name: 'Mock mediator orchestration',
    request: {
      path: '/some/path',
      method: 'GET',
      timestamp: (new Date()).toString()
    },
    response: {
      status: 200,
      body: 'Orchestrated response',
      timestamp: (new Date()).toString()
    }
  },
  properties: {
    prop1: 'val1',
    prop2: 'val2'
  }
})
