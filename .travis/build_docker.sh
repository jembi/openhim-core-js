#!/bin/bash

if [ "$TRAVIS_BRANCH" == "master" ] && [ "$TRAVIS_PULL_REQUEST" == "false" ]; then
    curl -H "Content-Type: application/json" --data '{"source_type": "Branch", "source_name": "core"}' -X POST https://registry.hub.docker.com/u/jembi/openhim-core/trigger/5cd6f182-c523-409e-ae68-9ab5de1f2849/
elif [ "$TRAVIS_BRANCH" == "test" ] && [ "$TRAVIS_PULL_REQUEST" == "false" ]; then
    curl -H "Content-Type: application/json" --data '{"docker_tag": "test"}' -X POST https://registry.hub.docker.com/u/jembi/openhim-core/trigger/5cd6f182-c523-409e-ae68-9ab5de1f2849/
elif [ "$TRAVIS_BRANCH" == "staging" ] && [ "$TRAVIS_PULL_REQUEST" == "false" ]; then
    curl -H "Content-Type: application/json" --data '{"docker_tag": "staging"}' -X POST https://registry.hub.docker.com/u/jembi/openhim-core/trigger/5cd6f182-c523-409e-ae68-9ab5de1f2849/
else
    echo "Docker image will only be built for commits to master/test/staging"
fi
