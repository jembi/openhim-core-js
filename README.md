[![Build Status](https://travis-ci.org/jembi/openhim-core-js.png?branch=master)](https://travis-ci.org/jembi/openhim-core-js) [![Dependency Status](https://david-dm.org/jembi/openhim-core-js.png)](https://david-dm.org/jembi/openhim-core-js) [![devDependency Status](https://david-dm.org/jembi/openhim-core-js/dev-status.png)](https://david-dm.org/jembi/openhim-core-js#info=devDependencies)

OpenHIM Core Component
======================

The OpenHIM core component is responsible for providing a single entry-point into an HIE as well as providing the following key features:

* Point of service client authentication and authorization
* Persistence and audit logging of all messages that flow through the OpenHIM
* Routing of messages to the correct service provider (be it an HIM orchestrator for further orchestration or the actual intended service provider)


See the [development roadmap](https://github.com/jembi/openhim-core-js/wiki/OpenHIM-core-Development-Roadmap) for more details on what is to come!

See [the documentation](https://github.com/jembi/openhim-core-js/wiki) for more details to get started.

# Quickstart Guide

0. Install [Node.js](http://nodejs.org/) 0.11.9 or greater
1. Install and start [MongoDB](http://www.mongodb.org/)
2. Clone the `https://github.com/jembi/openhim-core-js.git` repository or download [the code](https://github.com/jembi/openhim-core-js/archive/master.zip) to the desired location 
3. In the root folder of the downloaded/cloned source, run `sudo npm install . -g`
5. Start the server by executing `openhim-core`

Alternatively you can also use one of the following options:
* use [Vagrant](https://github.com/jembi/openhim-core-js/wiki/Running-the-OpenHIM-using-Vagrant) to fire up an instance if you're a developer, or just want a quick instance to test with, or
* use [Puppet](https://github.com/jembi/openhim-core-js/wiki/OpenHIM-Installation-using-Puppet) to deploy an instance on a server.

Installation and Development
============================

Clone the `https://github.com/jembi/openhim-core-js.git` repository or download [the code](https://github.com/jembi/openhim-core-js/archive/master.zip).

Prerequisites
-------------
* [Node.js](http://nodejs.org/) 0.11.9 or greater
* [Koa framework](http://koajs.com/)
* [MongoDB](http://www.mongodb.org/)

The OpenHIM core makes use of the [Koa framework](http://koajs.com/), which requires node version 0.11.9 or greater. Node also has to be run with the `--harmony` flag for this allocation to work.

The easiest way to use the latest version of node is to install [`nvm`](https://github.com/creationix/nvm). On Ubuntu, you can install using the install script but you have to add `[[ -s $HOME/.nvm/nvm.sh ]] && . $HOME/.nvm/nvm.sh # This loads NVM` to the end of your `~/.bashrc` file as well.

Once `nvm `is installed, run the following:

`nvm install 0.11`

`nvm alias default 0.11`

The latest version of node 0.11 should now be installed and set as default. The next step is to get all the required dependencies using `npm`. Navigate to the directory where the openhim-core-js source is located and run the following:

`npm install`

In order to run the OpenHIM core server, [MongoDB](http://www.mongodb.org/) must be installed and running.

### Installing MongoDB
_Skip this section if you have already installed MongoDB_
* [Linux install instructions](http://docs.mongodb.org/manual/administration/install-on-linux/):
  * in Ubuntu run `sudo apt-get install mongodb`
* [OSX install instructions](http://docs.mongodb.org/manual/tutorial/install-mongodb-on-os-x/):
  * using [Homebrew](http://brew.sh), run `brew update` followed by `brew install mongodb`
* To install MongoDB on Windows, follow the [Windows install instructions](http://docs.mongodb.org/manual/tutorial/install-mongodb-on-windows/).

For further information see the [MongoDB installation documentation](http://docs.mongodb.org/manual/installation/).

### Starting MongoDB

* [Starting MongoDB on Linux](http://docs.mongodb.org/manual/tutorial/install-mongodb-on-ubuntu/#run-mongodb):
  * in Ubuntu run `sudo service mongodb start`
* [Starting MongoDB on OSX](http://docs.mongodb.org/manual/tutorial/install-mongodb-on-os-x/#run-mongodb)
  * run `mongod` (or `mongod --dbpath <some alternate directory>` to manually specify your data directory)
* To run MongoDB on Windows, see the [Windows documentation](http://docs.mongodb.org/manual/tutorial/install-mongodb-on-windows/#start-mongodb).

For more information see the [MongoDB getting started guide](http://docs.mongodb.org/manual/tutorial/getting-started/).

### Testing
This step is optional but recommended to ensure that the system is running as expected. To run the tests see the [Testing](https://github.com/jembi/openhim-core-js#testing-1) section below.


Running the server
==================

First make sure the project is build by running `grunt build`.

Once all the prerequisites have been installed, configured and started, run the OpenHIM core server by executing the following:

`node --harmony lib/server.js`

The server will by default start in development mode using the mongodb database 'openhim-development'. To start the serve in production mode use the following:

`NODE_ENV=production node --harmony lib/server.js`

This starts the server with production defaults, including the use of the production mongodb database called 'openhim'.

To make use of your own custom configurations you can copy the [default.json](https://github.com/jembi/openhim-core-js/blob/master/config/default.json) config script and keep the settings you wish to override. You can then override the default configuration settings with the following command:

`--conf=path/to/customConfig.json`

So to start a production server with a custom config script it will look something like this:
`NODE_ENV=production node --harmony lib/server.js --conf=path/to/customConfig.json`

Running the OpenHIM on boot
===========================

To help you get the OpenHIM server running on boot we supply a upstart config file (good for Ubuntu or other system that use upstart). Install the upstart config by doing the following:

`sudo cp resources/openhim-core.conf /etc/init/`

Then run start the server with:

`sudo start openhim-core`

It will automatically startup on reboot.

Exporting/Importing Server Configuration
===========================

### Exporting
Follow the below steps to export and import the server metadata configuration. By default, the Users, Channels, Clients, ContactGroups and Mediators collections will be exported.
Copy the file [openhim-configuration-export.sh](https://github.com/jembi/openhim-core-js/blob/master/resources/openhim-configuration-export.sh) to a folder where you wish your export to be saved. Run the shell scrip by executing the following command:
`./openhim-configuration-export.sh`

Your exported collections should be located in the folder structure '/dump/openhim/'.

### Importing
To import you data successfully ensure that you are in the correct folder where the dump files are located. Execute the below command to  import your collections.
`mongorestore --db openhim dump/openhim`

NB! if you have changed your database name, then do so for the export/import as well.
NB! Please ensure that you stop the server before exporting and importing.


Testing
=======

This project uses [mocha](http://visionmedia.github.io/mocha/) as a unit testing framework with [should.js](https://github.com/visionmedia/should.js/) for assertions and [sinon.js](http://sinonjs.org/) for spies and mocks. The tests can be run using `grunt`:
```
grunt test
```

Alternatively you can also run the tests using `npm test`.

Design
------

To see some design docs refer to the OpenHIE wiki pages:

* [High level design](https://wiki.ohie.org/display/SUB/OpenHIE+Interoperability+Layer+design+document)
* [Technical design using node](https://wiki.ohie.org/display/SUB/Design+of+the+Interoperability+Layer+core+using+Node.js)
