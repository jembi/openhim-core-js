import http from 'k6/http'
import { check } from 'k6'
import {getTestAuthHeaders} from './auth.js'

const BASE_URL = __ENV.BASE_URL || 'https://127.0.0.1:8080'

export const options = {
  vus: 1,
  iterations: 100,
  thresholds: {
    http_req_duration: ['p(95)<600']
  },
  insecureSkipTLSVerify: true
}

function makeGetRequest () {
  const response = http.get(
    // Have to limit transactions to 100 as request times out for all transactions
    `${BASE_URL}/transactions?filterLimit=100`,
    {
      headers: Object.assign(getTestAuthHeaders(), {
        Accept: 'application/json',
        'Content-Type': 'apllication/json'
      }),
      tags: {
        name: 'Transactions without filters'
      }
    }
  )

  check(response, {
    'status code is 200': r => r.status === 200
  })
}

export default function () {
  makeGetRequest()
}
