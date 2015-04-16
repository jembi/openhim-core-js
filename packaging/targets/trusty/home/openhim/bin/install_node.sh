#!/bin/bash


USERNAME=openhim
HOME=/home/$USERNAME
export NVM_DIR=$HOME/.nvm 
NPM=$NVM_DIR/current/bin/npm
CURL=/usr/bin/curl
COREDIR=$HOME/openhim-core-js
SH=/bin/sh




. $HOME/.nvm/nvm.sh

cd $HOME

nvm install 0.12
nvm alias default 0.12
nvm use 0.12

cd $COREDIR

$NPM install
$NPM install  grunt-cli grunt

$COREDIR/node_modules/grunt-cli/bin/grunt build
