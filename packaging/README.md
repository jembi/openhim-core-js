Debian Packaging for the OpenHIM-core
=====================================

To create a debian package execute `./create-deb.sh`. This will run you through the process of creating a deb file. It can even upload a package to launchpad for inclusion in the ubuntu reposiotries if you so choose.

**Note:** The package is dependant on the system architecture that you build it on (amd64, i386 etc). So, ensure that you build it in ubuntu 14.04 64bit or change the architecture value in the control file. You may use a vagrant VM to build this, just use the following command to launch a vm: `vagrant init ubuntu/trusty64 && vagrant up && vagrant ssh`. Also, ensure that you are running the same version of node as that which the packaging installs.
