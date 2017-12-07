OpenHIM Core - development environment
======================================

Vagrant/Puppet can be used to setup a development instance of OpenHIM core. Simply run ```vagrant up``` from within the ```vagrant/``` directory.

A shared folder will be setup in the vm that includes the directory with the source code. So you can run the OpenHIM as follows:
```
cd /openhim-core-js/
node --harmony lib/server.js
```
Run the tests using `npm test` from the directory of the source code.