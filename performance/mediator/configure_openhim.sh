#!/bin/bash

set -eu

username=$1
password=$2
mediator_dir=$(dirname $0)
curl=$mediator_dir/../../resources/openhim-api-curl.sh

# Import the configurations
$curl "$username" "$password" \
  -H "Content-Type:application/json" \
  -d @$mediator_dir/openhim-insert.json \
  "https://localhost:8080/metadata"

# Add the certificate to the trust store
jq -n "{\"cert\":\"$(cat $mediator_dir/tls/cert.pem)\"}" | \
$curl "$username" "$password" \
  -H "Content-Type:application/json" \
  -d @- \
  "https://localhost:8080/keystore/ca/cert"
