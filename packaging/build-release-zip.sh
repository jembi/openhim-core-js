#!/bin/bash

set -eu

if (( $# < 1)); then
  echo "OpenHIM release build: Builds a specific tagged release ready for deployment";
  echo "Usage: $0 TAG";
  exit 0;
fi

tag=$1;
shift;

echo "NB!"
echo "To create the tagged build, various git interactions need to take place. "
echo "This will create a temporary branch as well as remove any changes you have havent yet committed"
read -p "Do you wish to proceed? [Y/y]" -n 1 -r

echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  cd ../

  echo "Git: setup branch/tag"
  git checkout -- .
  git checkout master
  git pull origin master
  git fetch --tags
  git checkout tags/$tag -b "build-release-$tag"

  echo "npm: clean and build package"
  rm -rf node_modules
  npm install
  npm run build

  echo "zip: build release version: $tag"
  zip \
    -i 'lib/*' 'config/*' 'node_modules/*' 'resources/*' 'CHANGELOG.md' 'LICENSE' 'package.json' 'package-lock.json' 'README.md' \
    -r packaging/build.openhim-core.$tag.zip .

  echo "Git cleanup"
  git checkout -- .
  git checkout master
  git branch -D "build-release-$tag"

  echo "New OpenHIM Core build zipped";
fi
