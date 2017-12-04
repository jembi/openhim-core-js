import http from 'k6/http'
import {check, group} from 'k6'
import {getTestAuthHeaders} from './auth.js'

const BASE_URL = __ENV.BASE_URL || 'https://localhost:8080'

export const options = {
  vus: 1,
  iterations: 100,
  thresholds: {
    http_req_duration: ['p(95)<50']
  },
  insecureSkipTLSVerify: true
}

function getMetricsByMinute() {
  const res = http.get(
    `${BASE_URL}/metrics/timeseries/minute?startDate=2017-12-01T10:00:00.000Z&endDate=2017-12-01T11:00:00.000Z`,
    {
      headers: Object.assign(getTestAuthHeaders(), {
        Accept: 'application/json'
      }),
      tags: {
        name: 'All metrics by minute'
      }
    }
  )
  check(res, {
    'status code is 200': r => r.status === 200
  })
}

function getMetricsByHour() {
  const res = http.get(
    `${BASE_URL}/metrics/timeseries/hour?startDate=2017-12-01T00:00:00.000Z&endDate=2017-12-01T23:59:59.999Z`,
    {
      headers: Object.assign(getTestAuthHeaders(), {
        Accept: 'application/json'
      }),
      tags: {
        name: 'All metrics by hour'
      }
    }
  )
  check(res, {
    'status code is 200': r => r.status === 200
  })
}

function getMetricsByDay() {
  const res = http.get(
    `${BASE_URL}/metrics/timeseries/day?startDate=2017-12-01&endDate=2017-12-08`,
    {
      headers: Object.assign(getTestAuthHeaders(), {
        Accept: 'application/json'
      }),
      tags: {
        name: 'All metrics by day'
      }
    }
  )
  check(res, {
    'status code is 200': r => r.status === 200
  })
}

function getMetricsByMonth() {
  const res = http.get(
    `${BASE_URL}/metrics/timeseries/month?startDate=2017-01-01&endDate=2017-12-31`,
    {
      headers: Object.assign(getTestAuthHeaders(), {
        Accept: 'application/json'
      }),
      tags: {
        name: 'All metrics by month'
      }
    }
  )
  check(res, {
    'status code is 200': r => r.status === 200
  })
}

function getMetricsByChannel() {
  const res = http.get(
    `${BASE_URL}/metrics/channels/303030303030303030303030?startDate=2017-01-01T00:00:00.000Z&endDate=2017-01-01T23:59:59.999Z`,
    {
      headers: Object.assign(getTestAuthHeaders(), {
        Accept: 'application/json'
      }),
      tags: {
        name: 'Metrics by channel'
      }
    }
  )
  check(res, {
    'status code is 200': r => r.status === 200
  })
}

export default function execute() {
  group('Metrics', () => {
    group('By time range', () => {
      group('By minute', getMetricsByMinute)
      group('By hour', getMetricsByHour)
      group('By day', getMetricsByDay)
      group('By month', getMetricsByMonth)
    })
    group('By channel', getMetricsByChannel)
  })
}
