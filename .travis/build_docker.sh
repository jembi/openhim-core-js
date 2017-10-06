#!/bin/bash

if ([ "$TRAVIS_BRANCH" == "master" ]) && [ "$TRAVIS_PULL_REQUEST" == "false" ]; then
    curl -H "Content-Type: application/json" --data '{"source_type": "Branch", "source_name": "core"}' -X POST https://registry.hub.docker.com/u/jembi/openhim-core/trigger/5cd6f182-c523-409e-ae68-9ab5de1f2849/
else
    echo "Docker image will only be built for commits to master"
fi

