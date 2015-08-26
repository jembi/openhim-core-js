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
$CURL -o- https://raw.githubusercontent.com/creationix/nvm/v0.26.1/install.sh | $SH > /dev/null
. $HOME/.nvm/nvm.sh

# Install node 0.12
echo "Installing node.js 0.12.7 via nvm ..."
nvm install 0.12.7
nvm alias default 0.12.7
nvm use 0.12.7

# Install OpenHIM, globally
echo "Installing OpenHIM v"$OPENHIM_VERSION" using npm ("`which npm`") ..."
npm install openhim-core@$OPENHIM_VERSION -g
echo "OpenHIM v"$OPENHIM_VERSION" installed!"

exit 0
