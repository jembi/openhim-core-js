#!/bin/bash
set -e

OPENHIM_VERSION=

USERNAME=openhim
HOME=/home/$USERNAME
CURL=/usr/bin/curl
SH=/bin/bash

cd $HOME

# Install NVM
echo "Installing node version manager for "$USERNAME" user ..."
$CURL -o- https://raw.githubusercontent.com/creationix/nvm/v0.32.1/install.sh | bash | $SH > /dev/null
. $HOME/.nvm/nvm.sh

# Install node
echo "Installing node.js LTS via nvm ..."
nvm install --lts
nvm alias default lts/*
nvm use default

exit 0
