#!/bin/bash

OPENHIM_VERSION=

USERNAME=openhim
HOME=/home/$USERNAME
CURL=/usr/bin/curl
SH=/bin/bash

cd $HOME

# Install NVM
$CURL -o- https://raw.githubusercontent.com/creationix/nvm/v0.26.1/install.sh | $SH
. $HOME/.nvm/nvm.sh

# Install node 0.12
nvm install 0.12.7
nvm alias default 0.12.7
nvm use 0.12.7

# Install OpenHIM, globally
echo "Installing OpenHIM v"$OPENHIM_VERSION" using npm ("`which npm`") ..."
npm install openhim-core@$OPENHIM_VERSION -g
