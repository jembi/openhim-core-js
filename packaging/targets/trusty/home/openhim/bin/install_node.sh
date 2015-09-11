#!/bin/bash
set -e

OPENHIM_VERSION=
NODE_VERSION=0.12.7

USERNAME=openhim
HOME=/home/$USERNAME
CURL=/usr/bin/curl
SH=/bin/bash

cd $HOME

# Install NVM
echo "Installing node version manager for "$USERNAME" user ..."
$CURL -o- https://raw.githubusercontent.com/creationix/nvm/v0.26.1/install.sh | $SH > /dev/null
. $HOME/.nvm/nvm.sh

# Install node
echo "Installing node.js $NODE_VERSION via nvm ..."
nvm install $NODE_VERSION
nvm alias default $NODE_VERSION
nvm use default

exit 0
