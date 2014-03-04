[![Build Status](https://travis-ci.org/jembi/openhim-core-js.png?branch=master)](https://travis-ci.org/jembi/openhim-core-js)

OpenHIM Core Component
======================

The OpenHIM core component is responcible for providing a single entrypoint into a HIE as well as providing a number of key features:

* Point of service application authentication and authorization
* Persistence and audit logging of all message that travel through the OpenHIM
* Routing on messages to the correct service provider (be it an HIM orchestrator for further orchestration or the actual intended service provider)

Note: The OpenHIM core component in this repository is currently in active and early development. It is not yet ready for production use.

# Quickstart Guide

1. Clone Repository `https://github.com/jembi/openhim-core-js.git` or Download code (https://github.com/jembi/openhim-core-js/archive/master.zip) to desired location
2. Install and Start Mongo or start mongoDB if already installed
3. run from a terminal/bash/command line `node --harmony lib/server.js`

Installation and Developent
===========================

Clone Repository `https://github.com/jembi/openhim-core-js.git` or Download code (https://github.com/jembi/openhim-core-js/archive/master.zip)

Prerequisits
------------
* Node 0.11.x
* Koa framework
* MongoDB

The OpenHIM-js require the [Koa framework](http://koajs.com/). Due to this node version 0.11.9+ is required. Node also has to be run with the `--harmony` flag for this allocation to work.

The easiest way to use the latest version of node is to install [nvm](https://github.com/creationix/nvm). On Ubuntu, you can install using the install script but you have to add `[[ -s $HOME/.nvm/nvm.sh ]] && . $HOME/.nvm/nvm.sh # This loads NVM` to the end of your `~/.bashrc` file as well.

Once nvm is isntalled, run the following:

`nvm install 0.11`

`nvm alias default 0.11`

The latest version of node 0.11 should be installed and set as default. Continuing in the installation / setup the next step is to get all the required dependancies. Invoking the `npm` command from within the base directory of where the code is cloned too will update your environment with the correct dependancies.

Navigate to the directory where the open-him-js source is located and run the following:

`npm install`

For the successful setup and running of the OpenHIM please ensure that Mongo is installed started and running on your system.

### Installing MongoDB
_Skip this section if you have already installed mongo_
* Installing on Ubuntu (Linux) [Linux Installation](http://docs.mongodb.org/manual/administration/install-on-linux/)
  * in Ubuntu run `sudo apt-get install mongodb`
* Installing on OSX (Mac) [OSX installation](http://docs.mongodb.org/manual/tutorial/install-mongodb-on-os-x/)
  * using [Brew](http://brew.sh) `brew update` followed by `brew install mongodb`
* Installing on Windows [Windows Installation](http://docs.mongodb.org/manual/tutorial/install-mongodb-on-windows/)

General install doc: [Mongo Install Docs](http://docs.mongodb.org/manual/installation/)

### Starting MongoDB
For more information please try the [MongoDB docs](http://docs.mongodb.org/manual/tutorial/getting-started/)
* Running on Ubuntu (Linux) [Linux Running Mongo](http://docs.mongodb.org/manual/tutorial/install-mongodb-on-ubuntu/#run-mongodb)
  * in Ubuntu run `sudo service mongodb start`
* Running on OSX (Mac) [OSX Running Mongo](http://docs.mongodb.org/manual/tutorial/install-mongodb-on-os-x/#run-mongodb)
  * run `mongod` and alternatively `mongod --dbpath <some alternate directory>` if your data directory isn't set.
* Running on Windows [Windows Running Mongo](http://docs.mongodb.org/manual/tutorial/install-mongodb-on-windows/#start-mongodb)


### Testing
This step is optional but recommended to ensure that all is running as expected. To execute tests see section on [Testing](https://github.com/carlsbox/openhim-core-js#testing-1)


Running the server
==================
With all the pre-requisits up and running the next step is in running the application.
Make sure you are running at least nodde version 0.11.9. To run the OpenHIM core component execute:

`node --harmony lib/server.js`


Testing
=======

This project uses [mocha](http://visionmedia.github.io/mocha/) as a unit testing framework with [should.js](https://github.com/visionmedia/should.js/) for assertions and [sinon.js](http://sinonjs.org/) for spies and mocks.

**To run the unit tests:**
The project allows 2 options for running tests:
* NPM based tests
* Cake based tests

To run the npm based tests execute `npm test`.

Running the Cake based tests it is recommended that you ensure that you have CoffeeScript installed and active in your environment. In order to install CoffeeScript run the following:

`npm install -g coffee-script` (Leave off the `-g` if you don't wish to install globally.) 
See [website](http://coffeescript.org/) for more details.

With a valid install of CoffeeScript continue to run:

`cake test` or 

You can have the CoffeeScript files in src/ auto compile as you save them by running:

`cake watch`

Design
------

To see some design docs refer to the OpenHIE wiki pages:

* [High level design](https://wiki.ohie.org/display/SUB/OpenHIE+Interoperability+Layer+design+document)
* [Technical design using node](https://wiki.ohie.org/display/SUB/Design+of+the+Interoperability+Layer+core+using+Node.js)
