#!/bin/bash

RELEASE_VERSION=$1
if [ -z ${RELEASE_VERSION} ]
then
  echo "You need so specify the release version you wish to build: e.g './build-docker-centos-rpm.sh 4.0.0'"
  echo "https://github.com/jembi/openhim-core-js/releases"
  exit 1
fi

set -eu

# Set docker container name to build RPM package
containerName=openhim-core-centos-rpm

# Define the CentOS version to build in the docker container
docker pull centos:7

docker run -t -d --rm --name $containerName centos:7 /bin/bash

echo "Update packages: "
docker exec -it $containerName sh -c "yum -y update"

echo "Install needed packages: "
docker exec -it $containerName sh -c "yum install -y git rpm-build redhat-rpm-config gcc-c++ make"

echo "Install needed packages: "
docker exec -it $containerName sh -c "curl -sL https://rpm.nodesource.com/setup_12.x | bash -"

echo "Install needed packages: "
docker exec -it $containerName sh -c "yum -y install nodejs-12.18.1"

echo "https://github.com/jembi/openhim-core-js/archive/v$RELEASE_VERSION.tar.gz"
echo "Fetch release version from Github"
docker exec -it $containerName sh -c "mkdir /openhim-core-js && curl -sL 'https://github.com/jembi/openhim-core-js/archive/v$RELEASE_VERSION.tar.gz' | tar --strip-components=1 -zxv -C /openhim-core-js"

echo "npm install && npm install speculate && npm run build"
docker exec -it $containerName sh -c "cd /openhim-core-js && npm install && npm install speculate && npm run build && npm run spec"

echo "Symlink the openhim-core folder with the rpmbuild folder"
docker exec -it $containerName sh -c "ln -s /openhim-core-js ~/rpmbuild"

# if the Release Version incluldes a dash, apply workaround for rpmbuild to not break on dashes
if [[ "${RELEASE_VERSION}" == *"-"* ]]
then
  RELEASE_VERSION_TEMP=${RELEASE_VERSION//-/_}
  echo "Release Version contains unsupported dash (-) for building rpm package. Replacing with underscore (_) temporarily"
  docker exec -it $containerName sh -c "sed -i 's/$RELEASE_VERSION/$RELEASE_VERSION_TEMP/g' ~/rpmbuild/SPECS/openhim-core.spec"
fi

echo "Build RPM package from spec"
docker exec -it $containerName sh -c "rpmbuild -bb ~/rpmbuild/SPECS/openhim-core.spec"

# if the Release Version incluldes a dash, apply workaround for rpmbuild to not break on dashes
if [[ "${RELEASE_VERSION}" == *"-"* ]]
then
  RELEASE_VERSION_TEMP=${RELEASE_VERSION//-/_}
  echo "Rename the generated RPM package to the expected release version name (revert the changes from underscore to dashes)"
  docker exec -it $containerName sh -c "mv /openhim-core-js/RPMS/x86_64/openhim-core-$RELEASE_VERSION_TEMP-1.x86_64.rpm /openhim-core-js/RPMS/x86_64/openhim-core-$RELEASE_VERSION-1.x86_64.rpm"
fi

echo "Extract RPM package from container"
docker cp $containerName:/openhim-core-js/RPMS/x86_64/openhim-core-$RELEASE_VERSION-1.x86_64.rpm .

# Stop the container to ensure it gets cleaned up after running to commands
echo "Removing the container"
docker stop $containerName
