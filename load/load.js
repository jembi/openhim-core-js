import http from 'k6/http'
import {check} from 'k6'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5001/http'

export const options = {
  duration: '30s',
  vus: 100,
  thresholds: {
    http_req_duration: ['p(95)<600']
  }
}

function makeRequest() {
  const response = http.get(
    `${BASE_URL}/mediator`,
    {
      headers: {
        Accept: 'application/json',
        Authorization: 'Basic cGVyZm9ybWFuY2U6cGVyZm9ybWFuY2U=',
        'Content-Type': 'application/json'
      },
      tags: {
        name: 'Get response'
      }
    }
  )
  check(response, {
    'status code is 200': r => r.status === 200
  })
}

export default function() {
  makeRequest()
}
