# Generate JWT Asymmetric Keys

The JWT Authentication mechanism can accept an asymmetric public key to decrypt tokens.
The OpenHIM can configure this public key in two ways.

Firstly, the public key literal can be supplied in the config.

Second, a file containing the public key in the `pem` format can be placed in the this directory. The **file name** can then be specified to the config.

> If you are using a Public Key file, it must be placed in this directory. i.e `openhim-core-js/resources/certs/jwt`

The config can be supplied to the OpenHIM in the following ways:

- Config File

  - Public Key Filename.

    ```js
    // production.json
    {
      ...
      "authentication": {
        ...
        "enableJWTAuthentication": true,
        "jwt": {
          "secretOrPublicKey": "<file-name>",
          ...
        }
      }
    }
    ```

  - Public Key Literal.

    ```js
    // production.json
    {
      ...
      "authentication": {
        ...
        "enableJWTAuthentication": true,
        "jwt": {
          "secretOrPublicKey": "-----BEGIN PUBLIC KEY-----\nMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA4ZnfOESxGfb1MVD2coNy\n0G0bGarnKEz721MP30iyo6+YO3qzbETI8giIWGBtXD2VO49xk2miVIvZ3tAfPRnE\nsqJsOErfZ3ld5GrnLUSbUOr88cd+TTx4EqdU2dYAoc0iVEgA5UZJDLrWHM3VcHQl\nFc2F/JN78JBBZor2gWiABEFFShMN1PYmsx4IJUuE72gDVqblOLCfr+V1rT0C7iA1\n7V8lsm3jlRyBBNxdwqLvVXVcIip5/W5gQ/Ujq4KdXcC4LFR2J8idLEn4LPNsx6tA\ndHmAaBEHO9kyYgHijK+zi0b7qTYaPdrbM6siMFBh7HW6bobRqrFy5wR3zZuhg2Do\no8djtoJBHXNohxNm1D7iiNjH9jHSt9G2O5lAuDo19qb0jxMBR/ekQ3GZNTF3+C7z\nF6BXDPXY3S2Q7btYznQ6oTn/raqVaw4RiXDaBSotmOZHId2OnI5eNN4QTXr7RbOX\nzSqXf4OhiaW7Shjg0bbz6BUAKiMW6e0R3Z+JL8ZS47MxG6ibfimbZz9a0Hc5ItN2\nZK0mPPr2aEeLi/Wyaf7QB1N5IEZVj3YXJo/h5F37RnxV9IbRA201lKAVw5RbWo3Q\nur5jumzuID68U+i4rvB2JILlSykIrcGa7ffoMtTKJzTiHrKElBAEdgv4I1pUl0Js\ne2rYU8Kno94WC+34WGoUs7sCAwEAAQ==\n-----END PUBLIC KEY-----",
          ...
        }
      }
    }
    ```

    > Note: Use newline characters in the string to ensure the key structure.

- Environment Variable

  - Public Key Filename.

    ```sh
    authentication_jwt_secretOrPublicKey='<file-name>'
    ```

  - Public Key Literal.

    ```sh
    authentication_jwt_secretOrPublicKey='-----BEGIN PUBLIC KEY-----\nMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA4ZnfOESxGfb1MVD2coNy\n0G0bGarnKEz721MP30iyo6+YO3qzbETI8giIWGBtXD2VO49xk2miVIvZ3tAfPRnE\nsqJsOErfZ3ld5GrnLUSbUOr88cd+TTx4EqdU2dYAoc0iVEgA5UZJDLrWHM3VcHQl\nFc2F/JN78JBBZor2gWiABEFFShMN1PYmsx4IJUuE72gDVqblOLCfr+V1rT0C7iA1\n7V8lsm3jlRyBBNxdwqLvVXVcIip5/W5gQ/Ujq4KdXcC4LFR2J8idLEn4LPNsx6tA\ndHmAaBEHO9kyYgHijK+zi0b7qTYaPdrbM6siMFBh7HW6bobRqrFy5wR3zZuhg2Do\no8djtoJBHXNohxNm1D7iiNjH9jHSt9G2O5lAuDo19qb0jxMBR/ekQ3GZNTF3+C7z\nF6BXDPXY3S2Q7btYznQ6oTn/raqVaw4RiXDaBSotmOZHId2OnI5eNN4QTXr7RbOX\nzSqXf4OhiaW7Shjg0bbz6BUAKiMW6e0R3Z+JL8ZS47MxG6ibfimbZz9a0Hc5ItN2\nZK0mPPr2aEeLi/Wyaf7QB1N5IEZVj3YXJo/h5F37RnxV9IbRA201lKAVw5RbWo3Q\nur5jumzuID68U+i4rvB2JILlSykIrcGa7ffoMtTKJzTiHrKElBAEdgv4I1pUl0Js\ne2rYU8Kno94WC+34WGoUs7sCAwEAAQ==\n-----END PUBLIC KEY-----'
    ```

    > Note: Use newline characters in the string to ensure the key structure.

## Generate RSASSA-PKCS1-v1_5 keys for **RS256**, **RS384**, and **RS512**

```sh
ssh-keygen -t rsa -b 4096 -m PEM -f jwtRS.key
# Don't add passphrase
openssl rsa -in jwtRS.key -pubout -outform PEM -out jwtRS.key.pub
cat jwtRS.key
cat jwtRS.key.pub
```

## Generate ECDSA keys for **ES256**, **ES384**, and **ES512**

```sh
ssh-keygen -t ecdsa -b 256 -m PEM -f jwtES.key
# Don't add passphrase
openssl ec -in jwtES.key -pubout -outform PEM -out jwtES.key.pub
cat jwtES.key
cat jwtES.key.pub
```

## Generate RSASSA-PSS keys for **PS256** and **PS384**

```sh
ssh-keygen -t rsa -b 4096 -m PEM -f jwtPS.key
# Don't add passphrase
openssl rsa -in jwtPS.key -pubout -outform PEM -out jwtPS.key.pub
cat jwtPS.key
cat jwtPS.key.pub
```
