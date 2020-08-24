# Packaging OpenHIM Core

## Bundled Release

A bundled release will ensure all the relevant dependencies are downloaded and bundled into a built version of the OpenHIM core. Only the relevant scripts needed to run the OpenHIM core are added to the bundled release.

To create a new build release execute the below command. This does assume that your Linux distribution has the `zip` module installed

`./build-release-zip.sh <TAG>`

E.g

`./build-release-zip.sh v5.2.5`

## CentOS RPM Packaging

Building the CentOS package makes uses of a CentOS docker container which runs various commands to build the package.

Execute the `build-docker-centos-rpm.sh` bash script with a specific release version as an argument to build the RPM package on a specific release version.

`build-docker-centos-rpm.sh 5.2.5` will build and RPM package for the 4.0.5 release of the OpenHIM

Once the bash script has completed and cleaned up after itself, you will see the built rpm package in the directory of this script. The package will look something like:
`openhim-core-5.2.5-1.x86_64.rpm`
