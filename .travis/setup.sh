#!/bin/bash
set -x # Show the output of the following commands (useful for debugging)
    
# Import the SSH deployment key
openssl aes-256-cbc -K $encrypted_78888cd548b2_key -iv $encrypted_78888cd548b2_iv -in .travis/deploy_key.enc -out deploy_key -d
chmod 600 deploy_key
mv deploy_key ~/.ssh/id_rsa


