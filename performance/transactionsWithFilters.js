import http from 'k6/http'
import { check, group } from 'k6'
import {getTestAuthHeaders} from './auth.js'

const BASE_URL = __ENV.BASE_URL || 'https://127.0.0.1:8080'
const status = 'Failed'
const startDate = '\\"2017-10-01T10:24:52+02:00\\"'
const endDate = '\\"2017-10-31T10:24:52+02:00\\"'
const channelID = '303030303030303030303030'

export const options = {
  vus: 1,
  iterations: 1000,
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
      headers: Object.assign(getTestAuthHeaders(), {
        Accept: 'application/json',
        'Content-Type': 'apllication/json'
      }),
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
      headers: Object.assign(getTestAuthHeaders(), {
        Accept: 'application/json',
        'Content-Type': 'apllication/json'
      }),
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
      headers: Object.assign(getTestAuthHeaders(), {
        Accept: 'application/json',
        'Content-Type': 'apllication/json'
      }),
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
      headers: Object.assign(getTestAuthHeaders(), {
        Accept: 'application/json',
        'Content-Type': 'apllication/json'
      }),
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
      headers: Object.assign(getTestAuthHeaders(), {
        Accept: 'application/json',
        'Content-Type': 'apllication/json'
      }),
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
      headers: Object.assign(getTestAuthHeaders(), {
        Accept: 'application/json',
        'Content-Type': 'apllication/json'
      }),
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
      headers: Object.assign(getTestAuthHeaders(), {
        Accept: 'application/json',
        'Content-Type': 'apllication/json'
      }),
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
  group('Transactions', () => {
    group('One Filter', () => {
      makeGetRequestWithDateRangeFilter()
      makeGetRequestWithStatusFilter()
      makeGetRequestWithChannelFilter()
    })
    group('Two filters', () => {
      makeGetRequestWithChannelAndDateRangeFilters()
      makeGetRequestWithChannelAndStatusFilters()
      makeGetRequestWithStatusAndDateRangeFilters()
    })
    group('Three filters', () => {
      makeGetRequestWithAllFilters()
    })
  })
}
