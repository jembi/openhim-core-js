#!/bin/bash
set -x # Show the output of the following commands (useful for debugging)

# Set variables
REMOTE_TARGET="test"
if [[ $1 ]]; then
    REMOTE_TARGET=$1 # target environment config: [test/staging]
fi
REMOTE_URL=188.166.147.164
NOW=`date +%Y%m%d%H%M%S`
API_PORT=8080
HTTP_PORT=5001
HTTPS_PORT=5000
if [[ $REMOTE_TARGET = 'test' ]]; then
    API_PORT=9090
    HTTP_PORT=6001
    HTTPS_PORT=6000
fi
NODE_ENV="production"
echo "Ports: $API_PORT, $HTTP_PORT, $HTTPS_PORT"

# Copy new Dockerfile to remote server
ssh -oStrictHostKeyChecking=no travis_deploy@188.166.147.164 "test -e ~/Dockerfile"
if [ $? -eq 0 ]; then
    # remove dockerfile if it exists to ensure using the latest version
    echo "File exists"
    ssh -oStrictHostKeyChecking=no travis_deploy@188.166.147.164 "rm ~/Dockerfile"
else
    echo "File is missing"
fi
scp -oStrictHostKeyChecking=no .travis/Dockerfile travis_deploy@$REMOTE_URL:~

# Copy config for target container with updated ports and mongo urls
ssh -oStrictHostKeyChecking=no travis_deploy@188.166.147.164 "test -e ~/$REMOTE_TARGET.json"
if [ $? -eq 0 ]; then
    # remove dockerfile if it exists to ensure using the latest version
    echo "File exists"
    ssh -oStrictHostKeyChecking=no travis_deploy@188.166.147.164 "rm ~/$REMOTE_TARGET.json"
else
    echo "File is missing"
fi
scp -oStrictHostKeyChecking=no .travis/$REMOTE_TARGET.json travis_deploy@$REMOTE_URL:~

# Log into remote server
ssh -oStrictHostKeyChecking=no travis_deploy@$REMOTE_URL <<EOF
    sudo su

    # backup & shutown current containers
    docker ps
    docker stop openhim-core-$REMOTE_TARGET
    # docker rm openhim-core-$REMOTE_TARGET-backup
    docker rename openhim-core-$REMOTE_TARGET openhim-core-$REMOTE_TARGET-backup-$NOW

    # Build docker image with latest changes
    docker build --build-arg branch=$REMOTE_TARGET -t $REMOTE_TARGET/openhim-core .
    rm Dockerfile # no-longer needed

    # install new container
    docker run -itd \
        -p $API_PORT:$API_PORT \
        -p $HTTPS_PORT:$HTTPS_PORT \
        -p $HTTP_PORT:$HTTP_PORT \
        -e mongo_url="mongodb://openhim-mongo/openhim-$REMOTE_TARGET" \
        -e mongo_atnaUrl="mongodb://openhim-mongo/openhim-$REMOTE_TARGET" \
        -e NODE_ENV="$NODE_ENV" \
        -v /home/travis_deploy/$REMOTE_TARGET.json:/etc/openhim-core-js/config/default.json \
        --network=openhim \
        --name=openhim-core-$REMOTE_TARGET \
        $REMOTE_TARGET/openhim-core

    # exit ssh & sudo sessions
    echo "Docker image built and deployed..."
    exit
    exit
EOF

