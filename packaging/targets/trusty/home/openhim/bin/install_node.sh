#!/bin/bash


USERNAME=openhim
HOME=/home/$USERNAME
NPM=/usr/bin/npm
CURL=/usr/bin/curl
COREDIR=$HOME/openhim-core-js
SH=/bin/sh


export NVM_DIR=$HOME/.nvm 

. $HOME/.nvm/nvm.sh

cd $HOME

nvm install 0.12
nvm alias default 0.12
nvm use 0.12

cd $COREDIR


$NPM install  grunt-cli grunt grunt-coffeelint grunt-contrib-coffee grunt-contrib-clean grunt-mocha-cli grunt-contrib-watch

$COREDIR/node_modules/grunt-cli/bin/grunt build
