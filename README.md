[![Build Status](https://travis-ci.org/jembi/openhim-core-js.png?branch=master)](https://travis-ci.org/jembi/openhim-core-js) [![Dependency Status](https://david-dm.org/jembi/openhim-core-js.png)](https://david-dm.org/jembi/openhim-core-js)

OpenHIM Core Component
======================

The OpenHIM core component is responsible for providing a single entry-point into an HIE as well as providing a number of key features:

* Point of service application authentication and authorization
* Persistence and audit logging of all message that travel through the OpenHIM
* Routing of messages to the correct service provider (be it an HIM orchestrator for further orchestration or the actual intended service provider)

:warning: **The OpenHIM core is currently in early active development and is not yet ready for production use.**

Development
-----------

The OpenHIM core makes use of the [Koa framework](http://koajs.com/), which requires node version 0.11.9 or greater. Node also has to be run with the `--harmony` flag for this allocation to work.

The easiest way to use the latest version of node is to install [nvm](https://github.com/creationix/nvm). On Ubuntu, you can install using the install script but you have to add `[[ -s $HOME/.nvm/nvm.sh ]] && . $HOME/.nvm/nvm.sh # This loads NVM` to the end of your `~/.bashrc` file as well.

Once nvm is installed, run the following:

`nvm install 0.11`

`nvm alias default 0.11`

Now you should have the latest version of node 0.11 installed and set as default.

To get started with the OpenHIM core you will need all the required dependencies. To get them run the following:

`npm install`

You will also need to install MongoDB, in Ubuntu run:

`sudo apt-get install mongodb`

This project uses [mocha](http://visionmedia.github.io/mocha/) as a unit testing framework with [should.js](https://github.com/visionmedia/should.js/) for assertions and [sinon.js](http://sinonjs.org/) for spies and mocks.

To run the unit tests:

`cake test` or `npm test`

You can have the CoffeeScript files in `src/` auto compile as you save them by running:

`cake watch`

Running the server
------------------

Make sure you are running at least node version 0.11.9. To run the OpenHIM core component execute:

`node --harmony lib/server.js`

Design
------

To see some design docs refer to the OpenHIE wiki pages:

* [High level design](https://wiki.ohie.org/display/SUB/OpenHIE+Interoperability+Layer+design+document)
* [Technical design using node](https://wiki.ohie.org/display/SUB/Design+of+the+Interoperability+Layer+core+using+Node.js)
