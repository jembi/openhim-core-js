Debian Packaging for the OpenHIM-core
=====================================

The package is dependant on the system architecture that you build it on (amd64, i386 etc). So, please use an amd64 Ubuntu environment to build this on.

To create a debian package execute `./create-deb.sh`. This will run you through the process of creating a deb file. It can even upload a package to launchpad for inclusion in the ubuntu reposiotries if you so choose.

To upload to launchpad you will have to have a public key create in gpg and registered with launchpad. You must link you .gnupg folder to the /packaging folder of this project for the upload to use it. From inside the /packaging folder execute `ln -s ~/.gnupg`.

You must also have an environment variable set with the id of the key to use. View your keys with `gpg --list-keys` and export the id (the part after the '/') with `export DEB_SIGN_KEYID=xxx`. Now you should be all set to upload to launchpad. Use the following details when running the ./create-deb script.

Login: openhie
PPA: release
