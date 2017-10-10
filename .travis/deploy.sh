#!/bin/bash
set -x # Show the output of the following commands (useful for debugging)

# Set variables
REMOTE_TARGET=test
if [[ $1 ]]; then
    REMOTE_TARGET=$1 # target environment config: [test/staging]
fi
REMOTE_URL=188.166.147.164

# Copy new Dockerfile to remote server
if ! scp -y "travis_deploy@$REMOTE_URL:~/Dockerfile" resources/docker/Dockerfile; then
    echo 'Remote file did not exist.'
    scp -oStrictHostKeyChecking=no resources/docker/Dockerfile travis_deploy@$REMOTE_URL:~
fi

# Log into remote server
ssh -oStrictHostKeyChecking=no travis_deploy@$REMOTE_URL

# backup & shutown current containers
docker ps
docker stop openhim-core-$REMOTE_TARGET
# docker rm openhim-core-$REMOTE_TARGET-backup
docker rename openhim-core-$REMOTE_TARGET openhim-core-$REMOTE_TARGET-backup

# Build docker image with latest changes
docker build -t jembi/openhim-core resources/docker
rm Dockerfile # no-longer needed

# install new container
# docker run -d -p 8080:8080 -p 5000:5000 -p 5001:5001 --network=$REMOTE_TARGET --name=openhim-core-$REMOTE_TARGET jembi/openhim-core

