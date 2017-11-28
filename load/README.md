# Instructions

Set up the mediator and configure the OpenHIM as per the README in the mediator
directory.

## Load Tests

To perform load test substitute `<BASE_URL>` with one of the values below and
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