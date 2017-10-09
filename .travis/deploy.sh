#!/bin/bash

# Copy new Dockerfile to remote server
if ! scp "travis_deploy@188.166.147.164:~/Dockerfile" resources/docker/Dockerfile; then
    echo 'Remote file did not exist.'
    # scp resources/docker/Dockerfile travis_deploy@188.166.147.164:~
fi

# Log into remote server
ssh travis_deploy@188.166.147.164

# backup & shutown current containers
docker ps
docker stop openhim-core-$REMOTE_TARGET
# docker rm openhim-core-$REMOTE_TARGET-backup
docker rename openhim-core-$REMOTE_TARGET openhim-core-$REMOTE_TARGET-backup

# Build docker image with latest changes
docker build -t openhim-core-js resources/docker

# install new container
# docker run -d -p 8080:8080 -p 5000:5000 -p 5001:5001 --network=$REMOTE_TARGET --name=openhim-core-$REMOTE_TARGET openhim-core-js
