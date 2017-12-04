# Instructions

Set up the mediator and configure the OpenHIM as per the README in the mediator
directory.

## Load Tests

Test the number of concurrent users that can be handled by the OpenHIM under
realistic circumstances.

To perform a load test, substitute `<BASE_URL>` with one of the values below and
run the following command:

```bash
docker run -e 'BASE_URL=<BASE_URL>' --net=host -i -v $PWD:/src loadimpact/k6 run /src/load.js
```

| Scenario | Base URL                    |
| -------- | --------------------------- |
| HTTP     | http://localhost:5001/http  |
| HTTPS    | http://localhost:5001/https |
| TCP      | http://localhost:7002       |
| TLS      | http://localhost:7003       |

## Volume Tests

Test the throughput of the OpenHIM when handling large response bodies.

To perform a volume test, substitute `<BASE_URL>` with one of the values below
and run the following command:

```bash
docker run -e 'BASE_URL=<BASE_URL>' --net=host -i -v $PWD:/src loadimpact/k6 run /src/volume.js
```

| Scenario | Base URL                    |
| -------- | --------------------------- |
| HTTP     | http://localhost:5001/http  |
| HTTPS    | http://localhost:5001/https |
| TCP      | http://localhost:7000       |
| TLS      | http://localhost:7001       |

## Stress Tests

Test the routing overhead of the OpenHIM under maximum throughput.

To perform a stress test, substitute `<BASE_URL>` with one of the values below
and run the following command:

```bash
docker run -e 'BASE_URL=<BASE_URL>' --net=host -i -v $PWD:/src loadimpact/k6 run /src/stress.js
```

| Scenario | Base URL                    |
| -------- | --------------------------- |
| HTTP     | http://localhost:5001/http  |
| HTTPS    | http://localhost:5001/https |
| TCP      | http://localhost:7004       |
| TLS      | http://localhost:7005       |

## Transaction Without Filter Tests

To perform a transaction test run the following command:

```bash
docker run --net=host -i -v $PWD:/src loadimpact/k6 run /src/transactionsWithoutFilters.js
```

## Transaction Filter Tests

To perform a transaction test run the following command:

```bash
docker run --net=host -i -v $PWD:/src loadimpact/k6 run /src/transactionsWithFilters.js
```

## Metrics Tests

To test the metrics endpoints run the following command:

```bash
docker run --net=host -i -v $PWD:/src loadimpact/k6 run /src/metrics.js
```

If metrics tests don't work (connection refused error) try replacing __localhost__ with __127.0.0.1__ in the metrics.js script URL

# InfluxDB Output

InfluxDB can be used as an output for test results. To set up InfluxDB and Chronograf for viewing the results run the following:

```bash
docker run --name=influx -d -p 8086:8086 influxdb
docker run --name=chronograf --net=host -d chronograf --influxdb-url=http://localhost:8086
```

Once it is up and running you can access Chronograf at http://localhost:8888.

In order to use the InfluxDB output for reporting test results you can pass the `-o influxdb=http://localhost:8086/k6` option to `k6 run`.

To create some dashboards in Chronograf run:

```bash
curl -XPOST -H "Content-Type:application/json" -d @dashboards/overview-dashboard.json localhost:8888/chronograf/v1/dashboards
curl -XPOST -H "Content-Type:application/json" -d @dashboards/metrics-dashboard.json localhost:8888/chronograf/v1/dashboards
curl -XPOST -H "Content-Type:application/json" -d @dashboards/transactions-dashboard.json localhost:8888/chronograf/v1/dashboards
```
