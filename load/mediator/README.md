## Instructions

Generate some certificates to be used by the HTTPS and TLS servers:

```bash
./generate_certs.sh
```

Start the server:

```bash
npm start
```

Set up the OpenHIM:

1. Log in to the console and navigate to `Export/Import`.
2. Import the `openhim-insert.json` file under the `Import Data` section.
3. Navigate to `Certificates`.
4. Import `tls/cert.pem` under the `Trusted Certificates` section.
5. Navigate to `Channels`.
6. Edit the route for each HTTPS or TLS channel and set the certificate to the
   one that was just imported.
