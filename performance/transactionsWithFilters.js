import http from 'k6/http'
import { check } from 'k6'
const auth = require('./auth.js')

const BASE_URL = __ENV.BASE_URL || 'https://127.0.0.1:8080'
const status = 'Failed'
const startDate = '\\"2017-11-29T10:24:52+02:00\\"'
const endDate = '\\"2017-12-01T10:24:52+02:00\\"'
const channelID = '5a1d74be0cc902172d6c5f9b'

export const options = {
  vus: 1,
  iterations: 100,
  thresholds: {
    http_req_duration: ['p(95)<60']
  },
  insecureSkipTLSVerify: true
}

function makeGetRequestWithStatusFilter () {
  const query = encodeURIComponent(`{"status":"${status}"}`)
  const response = http.get(
    `${BASE_URL}/transactions?filterLimit=100&filters=${query}`,
    {
      headers: auth.getTestAuthHeaders(),
      tags: {
        name: 'Transactions with Status filter'
      }
    }
  )
  check(response, {
    'status code is 200': r => r.status === 200
  })
}

function makeGetRequestWithDateRangeFilter () {
  const query = encodeURIComponent(`{"request.timestamp":"{\\"$gte\\":${startDate},\\"$lte\\":${endDate}}"}`)
  const response = http.get(
    `${BASE_URL}/transactions?filterLimit=100&filters=${query}`,
    {
      headers: auth.getTestAuthHeaders(),
      tags: {
        name: 'Transactions with Date Range Filter'
      }
    }
  )
  check(response, {
    'status code is 200': r => r.status === 200
  })
}

function makeGetRequestWithChannelFilter () {
  const query = encodeURIComponent(`{"channelID":"${channelID}"}`)
  const response = http.get(
    `${BASE_URL}/transactions?filterLimit=100&filters=${query}`,
    {
      headers: auth.getTestAuthHeaders(),
      tags: {
        name: 'Transactions with Channel Filter'
      }
    }
  )
  check(response, {
    'status code is 200': r => r.status === 200
  })
}

function makeGetRequestWithChannelAndDateRangeFilters () {
  const query = encodeURIComponent(`{"channelID":"${channelID}", "request.timestamp":"{\\"$gte\\":${startDate},\\"$lte\\":${endDate}}"}`)
  const response = http.get(
    `${BASE_URL}/transactions?filterLimit=100&filters=${query}`,
    {
      headers: auth.getTestAuthHeaders(),
      tags: {
        name: 'Transactions with Channel and Date Range Filters'
      }
    }
  )
  check(response, {
    'status code is 200': r => r.status === 200
  })
}

function makeGetRequestWithChannelAndStatusFilters () {
  const query = encodeURIComponent(`{"channelID":"${channelID}", "status":"${status}"}`)
  const response = http.get(
    `${BASE_URL}/transactions?filterLimit=100&filters=${query}`,
    {
      headers: auth.getTestAuthHeaders(),
      tags: {
        name: 'Transactions with Channel and Status Filters'
      }
    }
  )
  check(response, {
    'status code is 200': r => r.status === 200
  })
}

function makeGetRequestWithStatusAndDateRangeFilters () {
  const query = encodeURIComponent(`{"request.timestamp":"{\\"$gte\\":${startDate},\\"$lte\\":${endDate}}", "status":"${status}"}`)
  const response = http.get(
    `${BASE_URL}/transactions?filterLimit=100&filters=${query}`,
    {
      headers: auth.getTestAuthHeaders(),
      tags: {
        name: 'Transactions with Status and Date Range Filters'
      }
    }
  )
  check(response, {
    'status code is 200': r => r.status === 200
  })
}

function makeGetRequestWithAllFilters () {
  const query = encodeURIComponent(`{"channelID":"${channelID}","request.timestamp":"{\\"$gte\\":${startDate},\\"$lte\\":${endDate}}", "status":"${status}"}`)
  const response = http.get(
  `${BASE_URL}/transactions?filterLimit=100&filters=${query}`,
    {
      headers: auth.getTestAuthHeaders(),
      tags: {
        name: 'Transactions with Status, Channel and Date Range Filters'
      }
    }
  )
  check(response, {
    'status code is 200': r => r.status === 200
  })
}

export default function () {
  makeGetRequestWithDateRangeFilter()
  makeGetRequestWithStatusFilter()
  makeGetRequestWithChannelFilter()
  makeGetRequestWithChannelAndDateRangeFilters()
  makeGetRequestWithChannelAndStatusFilters()
  makeGetRequestWithStatusAndDateRangeFilters()
  makeGetRequestWithAllFilters()
}
