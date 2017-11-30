import http from 'k6/http'
import {check, sleep} from 'k6'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5001/http'

export const options = {
  stages: [
    {duration: '30s', target: 100},
    {duration: '1m'},
    {duration: '30s', target: 0}
  ],
  thresholds: {
    http_req_duration: ['p(95)<600']
  }
}

function makeGetRequest() {
  const response = http.get(
    `${BASE_URL}/mediator`,
    {
      headers: {
        Accept: 'application/json',
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

function makePostRequest() {
  const response = http.post(
    `${BASE_URL}/mediator`,
    '{"hello": "world"}',
    {
      headers: {
        Accept: 'application/json',
        Authorization: 'Basic cGVyZm9ybWFuY2U6cGVyZm9ybWFuY2U=',
        'Content-Type': 'application/json'
      },
      tags: {
        name: 'Post request'
      }
    }
  )
  check(response, {
    'status code is 200': r => r.status === 200
  })
}

function think() {
  sleep(Math.random() * 0.5)
}

export default function() {
  makeGetRequest()
  think()
  makePostRequest()
}
