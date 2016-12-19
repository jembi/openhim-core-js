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
$CURL -o- https://raw.githubusercontent.com/creationix/nvm/v0.32.1/install.sh | $SH > /dev/null
. $HOME/.nvm/nvm.sh

# Install node
nvm install --lts || true

exit 0
