#! /bin/bash

curl -H 'Content-Type: application/json' --data '{"source_type": "Branch", "source_name": "core"}' -X POST https://registry.hub.docker.com/u/jembi/openhim-core/trigger/5cd6f182-c523-409e-ae68-9ab5de1f2849/