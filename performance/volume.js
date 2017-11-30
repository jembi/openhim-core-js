import http from 'k6/http'
import {check} from 'k6'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5001/http'

export const options = {
  vus: 10,
  iterations: 1000,
  thresholds: {
    http_req_receiving: ['p(95)<100'],
    http_req_duration: ['p(95)<100']
  }
}

function makeGetRequest() {
  const response = http.get(
    `${BASE_URL}/body`,
    {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'identity',
        Authorization: 'Basic cGVyZm9ybWFuY2U6cGVyZm9ybWFuY2U='
      },
      tags: {
        name: 'Get request'
      }
    }
  )
  check(response, {
    'status code is 200': r => r.status === 200
  })
}

export default function() {
  makeGetRequest()
}
