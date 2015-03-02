Test https with mutual auth to JsonStub
=======================================
```
curl -v --insecure --key test/resources/client-tls/key.pem --cert test/resources/client-tls/cert.pem https://localhost:5000/sample/api -H "JsonStub-User-Key: 0582582f-89b8-436e-aa76-ba5444fc219d" -H "JsonStub-Project-Key: 1a841ebc-405e-474e-a8fa-9c401c823ae6"
```

Other useful commands
=====================

```
openssl s_client -connect localhost:5000 -key test/resources/trust-tls/key1.pem -cert test/resources/trust-tls/cert1.pem -CAfile resources/certs/default/cert.pem
```

```
loadtest -n 5 https://localhost:5000/load-test --insecure --key test/resources/trust-tls/key1.pem --cert test/resources/trust-tls/cert1.pem -P 'TEST POST BODY'
```

```
loadtest -n 5 http://localhost:5001/load-test -H Authorization:'Basic dGVzdDp0ZXN0' -P 'TEST POST BODY'
```