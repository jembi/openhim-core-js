[![Build Status](https://travis-ci.org/jembi/openhim-core-js.png?branch=master)](https://travis-ci.org/jembi/openhim-core-js) [![Dependency Status](https://david-dm.org/jembi/openhim-core-js.png)](https://david-dm.org/jembi/openhim-core-js) [![devDependency Status](https://david-dm.org/jembi/openhim-core-js/dev-status.png)](https://david-dm.org/jembi/openhim-core-js#info=devDependencies)

OpenHIM Core Component
======================

The OpenHIM core component is responsible for providing a single entry-point into an HIE as well as providing the following key features:

* Point of service client authentication and authorization
* Persistence and audit logging of all messages that flow through the OpenHIM
* Routing of messages to the correct service provider (be it an HIM orchestrator for further orchestration or the actual intended service provider)

:warning:  **The OpenHIM core is currently in early active development and is not yet ready for production use.**

See the [development roadmap](https://github.com/jembi/openhim-core-js/wiki/OpenHIM-core-Development-Roadmap) for more details on what is to come!

See [the documentation](https://github.com/jembi/openhim-core-js/wiki) for more details to get started.

# Quickstart Guide

0. Install [Node.js](http://nodejs.org/) 0.11.9 or greater
1. Clone the `https://github.com/jembi/openhim-core-js.git` repository or download [the code](https://github.com/jembi/openhim-core-js/archive/master.zip) to the desired location
2. Install and start [MongoDB](http://www.mongodb.org/)
3. Install the dependencies by running `npm install`
4. Build the project by running `cake build` (you may have to install coffescript first by running `npm install -g coffee-script`)
5. Start the server by running `node --harmony lib/server.js`

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

First make sure the project is build by running `cake build`.

Once all the prerequisites have been installed, configured and started, run the OpenHIM core server by executing the following:

`node --harmony lib/server.js`

The server will by default start in development mode using the mongodb database 'openhim-development'. To start the serve in production mode use the following:

`NODE_ENV=production node --harmony lib/server.js`

This starts the server with production defaults, including the use of the production mongodb database called 'openhim'.

Testing
=======

This project uses [mocha](http://visionmedia.github.io/mocha/) as a unit testing framework with [should.js](https://github.com/visionmedia/should.js/) for assertions and [sinon.js](http://sinonjs.org/) for spies and mocks. The tests can be run using either `npm` or `cake`.

To run the tests using `npm` execute `npm test`.

The project is build and tested using `cake`, if you want to run cake directly, you will need [CoffeeScript](http://coffeescript.org/). Install CoffeeScript by executing the following:

`npm install -g coffee-script` (omit the `-g` if you don't wish to install globally) 

See [the CoffeScript website](http://coffeescript.org/) for more further information.

You can have the CoffeeScript files in `src/` auto compile as you save them by running:

`cake watch`

Design
------

To see some design docs refer to the OpenHIE wiki pages:

* [High level design](https://wiki.ohie.org/display/SUB/OpenHIE+Interoperability+Layer+design+document)
* [Technical design using node](https://wiki.ohie.org/display/SUB/Design+of+the+Interoperability+Layer+core+using+Node.js)
