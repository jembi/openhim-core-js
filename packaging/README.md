Packaging OpenHIM Core
=====================================

# Debian Packaging

The package is dependant on the system architecture that you build it on (amd64, i386 etc). So, please use an amd64 Ubuntu environment to build this on.

To create a debian package execute `./create-deb.sh`. This will run you through the process of creating a deb file. It can even upload a package to launchpad for inclusion in the ubuntu reposiotries if you so choose.

To upload to launchpad you will have to have a public key create in gpg and registered with launchpad. You must link you .gnupg folder to the /packaging folder of this project for the upload to use it. From inside the /packaging folder execute `ln -s ~/.gnupg`.

You must also have an environment variable set with the id of the key to use. View your keys with `gpg --list-keys` and export the id (the part after the '/') with `export DEB_SIGN_KEYID=xxx`. Now you should be all set to upload to launchpad. Use the following details when running the ./create-deb script.

Login: openhie
PPA: release

# CentOS RPM Packaging

Building the CentOS package makes uses of a CentOS docker container which runs various commands to build the package.

Execute the `build-docker-centos-rpm.sh` bash script with a specific release version as an argument to build the RPM package on a specific release version.

`build-docker-centos-rpm.sh 4.0.5` will build and RPM package for the 4.0.5 release of the OpenHIM

Once the bash script has completed and cleaned up after itself, you will see the built rpm package in the directory of this script. The package will look something like:
`openhim-core-4.0.5-1.x86_64.rpm`
