Test https with mutual auth to JsonStub
=======================================
```
curl -v --insecure --key test/resources/client-tls/key.pem --cert test/resources/client-tls/cert.pem https://localhost:5000/sample/api -H "JsonStub-User-Key: 0582582f-89b8-436e-aa76-ba5444fc219d" -H "JsonStub-Project-Key: 1a841ebc-405e-474e-a8fa-9c401c823ae6"
```
