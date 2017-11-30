#!/bin/bash

set -eu

openssl req -x509 -nodes -newkey rsa:4096 -keyout tls/key.pem -out tls/cert.pem -days 3650
