#!/bin/bash

SOURCEDIR="<%= @source_dir %>"

cd $SOURCEDIR;
git pull && FACTER_ENVIRONMENT=deployment bash -c 'puppet apply infrastructure/deployment/env/openhim-core-js.pp'
