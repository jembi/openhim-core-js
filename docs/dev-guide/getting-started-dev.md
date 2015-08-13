Getting started with OpenHIM development
========================================

You can use vagrant if you would want to get up and running quickly with a dev environment in a vm. See here to [use Vagrant](https://github.com/jembi/openhim-core-js/wiki/Running-the-OpenHIM-using-Vagrant) to fire up an instance. Otherwise, read on to learn more.

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

`npm start` (this runs `grunt build` then `node --harmony lib/server.js` behind the scenes)

The server will by default start in development mode using the mongodb database 'openhim-development'. To start the serve in production mode use the following:

`NODE_ENV=production node --harmony lib/server.js`

This starts the server with production defaults, including the use of the production mongodb database called 'openhim'.

This project uses [mocha](http://visionmedia.github.io/mocha/) as a unit testing framework with [should.js](https://github.com/visionmedia/should.js/) for assertions and [sinon.js](http://sinonjs.org/) for spies and mocks. The tests can be run using `npm test`.

**Pro tips:**

* `grunt watch` - will automatically build the project on any changes.
* `grunt lint` - ensure the code is lint free, this is also run before an `npm test`
* `npm link` - will symlink you local working directory to the globally installed openhim-core module. Use this so you can use the global openhim-core binary to run your current work in progress. Also, if you build any local changes the server will automatically restart.
* `grunt test --mochaGrep=<regex>` - will only run tests with names matching the regex
* `grunt test --ddebugTests` - enabled the node debugger while running unit tests. Add `debugger` statements and use `node debug localhost:5858` to connect to the debugger instance.