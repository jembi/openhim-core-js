[![Build Status](https://travis-ci.org/jembi/openhim-core-js.png?branch=master)](https://travis-ci.org/jembi/openhim-core-js) [![Dependency Status](https://david-dm.org/jembi/openhim-core-js.png)](https://david-dm.org/jembi/openhim-core-js) [![devDependency Status](https://david-dm.org/jembi/openhim-core-js/dev-status.png)](https://david-dm.org/jembi/openhim-core-js#info=devDependencies)

OpenHIM Core Component
======================

The OpenHIM core component is responsible for providing a single entry-point into an HIE as well as providing the following key features:

* Point of service client authentication and authorization
* Persistence and audit logging of all messages that flow through the OpenHIM
* Routing of messages to the correct service provider (be it an HIM orchestrator for further orchestration or the actual intended service provider)


See the [development roadmap](https://github.com/jembi/openhim-core-js/wiki/OpenHIM-core-Development-Roadmap) for more details on what is to come!

See [the documentation](https://github.com/jembi/openhim-core-js/wiki) for more details to get started.

For additional information and tutorials see [openhim.org](http://openhim.org).

Getting started with the OpenHIM-core
-------------------------------------

1. Install the latest stable [Node.js](http://nodejs.org/) 0.12.0 or greater.
2. Install and start [MongoDB](http://www.mongodb.org/) 2.4 or greater.
3. Install the OpenHIM-core package globally: `npm install openhim-core -g`, this will also install an openhim-core binary to your PATH.
4. Start the server by executing `openhim-core` from anywhere.

To make use of your own custom configurations you can copy the [default.json](https://github.com/jembi/openhim-core-js/blob/master/config/default.json) config file and override the default setting:

```
wget https://raw.githubusercontent.com/jembi/openhim-core-js/master/config/default.json
# edit default.json, then
openhim-core --conf=path/to/default.json
```

Developer guide
---------------

You can use vagrant if you would want to get up and running quickly with a dev environment in a vm. See here to [use Vagrant](https://github.com/jembi/openhim-core-js/wiki/Running-the-OpenHIM-using-Vagrant) to fire up an instance. 

Clone the `https://github.com/jembi/openhim-core-js.git` repository.

Ensure you have the following installed:
* [Node.js](http://nodejs.org/) 0.12.0 or greater
* [MongoDB](http://www.mongodb.org/) (in Ubuntu run `sudo apt-get install mongodb`, in OSX using [Homebrew](http://brew.sh), run `brew update` followed by `brew install mongodb`)

The OpenHIM core makes use of the [Koa framework](http://koajs.com/), which requires node version 0.12.0 or greater. Node also has to be run with the `--harmony` flag for Koa to work as it needs generator support.

The easiest way to use the latest version of node is to install [`nvm`](https://github.com/creationix/nvm). On Ubuntu, you can install using the install script but you have to add `[[ -s $HOME/.nvm/nvm.sh ]] && . $HOME/.nvm/nvm.sh # This loads NVM` to the end of your `~/.bashrc` file as well.

Once `nvm `is installed, run the following:

`nvm install 0.12`

`nvm alias default 0.12`

The latest version of node 0.12 should now be installed and set as default. The next step is to get all the required dependencies using `npm`. Navigate to the directory where the openhim-core-js source is located and run the following:

`npm install`

Then build the project:

`grunt build`

In order to run the OpenHIM core server, [MongoDB](http://www.mongodb.org/) must be installed and running.

To run the server, execute:

`node --harmony lib/server.js`

The server will by default start in development mode using the mongodb database 'openhim-development'. To start the serve in production mode use the following:

`NODE_ENV=production node --harmony lib/server.js`

This starts the server with production defaults, including the use of the production mongodb database called 'openhim'.

This project uses [mocha](http://visionmedia.github.io/mocha/) as a unit testing framework with [should.js](https://github.com/visionmedia/should.js/) for assertions and [sinon.js](http://sinonjs.org/) for spies and mocks. The tests can be run using `npm test`.

**Useful tips:**

* `grunt watch` - will automatically build the project on any changes.
* `grunt lint` - ensure the code is lint free, this is also run before an `npm test`
* `npm link` - will symlink you local working directory to the globally installed openhim-core module. Use this so you can use the global openhim-core binary to run your current work in progress. Also, if you build any local changes the server will automatically restart.

Running the OpenHIM on boot
---------------------------

To help you get the OpenHIM server running on boot we supply a upstart config file (good for Ubuntu or other system that use upstart). Install the upstart config by doing the following:

```
wget https://raw.githubusercontent.com/jembi/openhim-core-js/master/resources/openhim-core.conf
sudo cp openhim-core.conf /etc/init/
```

Then run start the server with:

`sudo start openhim-core`

It will automatically startup on reboot.

If you require custom config you will have to edit `openhim-core.conf` to add in the `--conf` parameter pointing to your external config file.

Contributing
------------

You may view/add issues here: https://github.com/jembi/openhim-core-js/issues

To contibute code, please fork the repository and submit a pull request. The maintainers will review the code and merge it in if all is well.

Exporting/Importing Server Configuration
----------------------------------------

**Note:** This can now be done from the OpenHIM console which may be easier.

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

Design
------

To see some design docs refer to the OpenHIE wiki pages:

* [High level design](https://wiki.ohie.org/display/SUB/OpenHIE+Interoperability+Layer+design+document)
* [Technical design using node](https://wiki.ohie.org/display/SUB/Design+of+the+Interoperability+Layer+core+using+Node.js)
