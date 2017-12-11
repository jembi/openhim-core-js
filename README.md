[![Build Status](https://travis-ci.org/jembi/openhim-core-js.png?branch=master)](https://travis-ci.org/jembi/openhim-core-js) [![Dependency Status](https://david-dm.org/jembi/openhim-core-js.png)](https://david-dm.org/jembi/openhim-core-js) [![devDependency Status](https://david-dm.org/jembi/openhim-core-js/dev-status.png)](https://david-dm.org/jembi/openhim-core-js#info=devDependencies) [![codecov](https://codecov.io/gh/jembi/openhim-core-js/branch/master/graph/badge.svg)](https://codecov.io/gh/jembi/openhim-core-js)

OpenHIM Core Component
======================

The OpenHIM core component is responsible for providing a single entry-point into an HIE as well as providing the following key features:

* Point of service client authentication and authorization
* Persistence and audit logging of all messages that flow through the OpenHIM
* Routing of messages to the correct service provider (be it an HIM orchestrator for further orchestration or the actual intended service provider)

**To get started and to learn more about using the OpenHIM** see [the full documentation](http://openhim.rtfd.org).

Some of the important information is repeated here, however, the the above documentation is much more comprehensive.

Getting started with the OpenHIM-core
-------------------------------------

1. Install the latest stable [Node.js](http://nodejs.org/) v8.9 or greater. The latest [active LTS](https://github.com/nodejs/LTS) is recommended.
2. Install and start [MongoDB](http://www.mongodb.org/) 2.6 or greater.
3. Install the OpenHIM-core package globally: `npm install openhim-core -g`, this will also install an openhim-core binary to your PATH.
4. Start the server by executing `openhim-core` from anywhere.

To make use of your own custom configurations you can copy the [default.json](https://github.com/jembi/openhim-core-js/blob/master/config/default.json) config file and override the default setting:

```
wget https://raw.githubusercontent.com/jembi/openhim-core-js/master/config/default.json
# edit default.json, then
openhim-core --conf=path/to/default.json
```

For more information about the config options, [click here](https://github.com/jembi/openhim-core-js/blob/master/config/config.md).

**Note:** one of the first things that you should do once the OpenHIM is up and running is setup a properly signed TLS certificate. You can do this through the [OpenHIM console](https://github.com/jembi/openhim-console) under 'Certificates' on the sidebar.

Developer guide
---------------

You can use vagrant if you would want to get up and running quickly with a dev environment in a vm. See here to [use Vagrant](https://github.com/jembi/openhim-core-js/wiki/Running-the-OpenHIM-using-Vagrant) to fire up an instance.

Clone the `https://github.com/jembi/openhim-core-js.git` repository.

Ensure you have the following installed:
* [Node.js](http://nodejs.org/) v8.9 or greater
* [MongoDB](http://www.mongodb.org/) (in Ubuntu run `sudo apt-get install mongodb`, in OSX using [Homebrew](http://brew.sh), run `brew update` followed by `brew install mongodb`)

The OpenHIM core makes use of the [Koa framework](http://koajs.com/), which requires node version v4 or greater.

The easiest way to use the latest version of node is to install [`nvm`](https://github.com/creationix/nvm). On Ubuntu, you can install using the install script but you have to add `[[ -s $HOME/.nvm/nvm.sh ]] && . $HOME/.nvm/nvm.sh # This loads NVM` to the end of your `~/.bashrc` file as well.

Once `nvm `is installed, run the following:

`nvm install 8.9`

`nvm alias default 8.9`

The latest version of node 4 should now be installed and set as default. The next step is to get all the required dependencies using `npm`. Navigate to the directory where the openhim-core-js source is located and run the following:

`npm install`

Then build the project:

`grunt build`

In order to run the OpenHIM core server, [MongoDB](http://www.mongodb.org/) must be installed and running.

To run the server, execute:

`npm start` (this runs `grunt build` then `node --harmony lib/server.js` behind the scenes)

The server will by default start in development mode using the mongodb database 'openhim-development'. To start the serve in production mode use the following:

`NODE_ENV=production node --harmony lib/server.js`

This starts the server with production defaults, including the use of the production mongodb database called 'openhim'.

This project uses [mocha](https://mochajs.org/) as a unit testing framework with [should.js](https://github.com/visionmedia/should.js/) for assertions and [sinon.js](http://sinonjs.org/) for spies and mocks. The tests can be run using `npm test`.

**Pro tips:**

* `grunt watch` - will automatically build the project on any changes.
* `grunt lint` - ensure the code is lint free, this is also run before an `npm test`
* `npm link` - will symlink you local working directory to the globally installed openhim-core module. Use this so you can use the global openhim-core binary to run your current work in progress. Also, if you build any local changes the server will automatically restart.
* `npm test -- --mochaGrep=<regex>` - will only run tests with names matching the regex
* `npm test -- --debugTests` - enabled the node debugger while running unit tests. Add `debugger` statements and use `node debug localhost:5858` to connect to the debugger instance.
* `npm test -- --bail` - exit on first test failure.

Deployments
------------

All commits to the `master` branch will automatically trigger a build of the latest changes into a docker image on dockerhub.

All commits directly to `staging` or `test` will automatically build and deploy a docker image to the test and staging servers respectively.

Deployments are handled by travis, which uses the bash script `deploy.sh` to upload the dockerfile to the target server, build it and backup existing containers and deploy the latest changes.

## Creating CentOS RPM package

The build process for the RPM package is based off [this](https://github.com/bbc/speculate/wiki/Packaging-a-Node.js-project-as-an-RPM-for-CentOS-7) blog. The reason for using vagrant instead of docker is so that we can test the RPM package by running it as a service using SystemCtl - similar to how it will likely be used in a production environment. SystemCtl is not available out the box in docker containers.

Refer to this [blog](https://developers.redhat.com/blog/2014/05/05/running-systemd-within-docker-container/) for a more detailed description of a possible work-around. This is not recommended since it is a hack. This is where vagrant comes in since it sets up an isolated VM.

1. Setup environment

Navigate to the infrastructure folder: `infrastructure/centos`

Provision VM and automatically build RPM package:
```bash
vagrant up
```
or without automatic provisioning (useful if you prefer manual control of the process):
```bash
vagrant up --no-provision
```

2. [Optional] The Vagrantfile provisions the VM with the latest source code from master and attempts to compile the RPM package for you. However in the event an error occurs, or if you prefer to have manual control over the process, then you'll need to do the following:

* Remote into the VM: `vagrant ssh`
* Download or sync all source code into VM.
* Ensure all dependencies are installed.
```bash
npm i && npm i speculate
```
* Run speculate to generate the SPEC files needed to build the RPM package.
```bash
npm run spec
```
* Ensure the directory with the source code is linked to the rpmbuild directory - the folder RPMBUILD will use.
```bash
ln -s ~/openhim-core ~/rpmbuild
```
* Build RPM package.
```bash
rpmbuild -bb ~/rpmbuild/SPECS/openhim-core.spec
```

3. Install & Test package

```bash
sudo yum install -y ~/rpmbuild/RPMS/x86_64/openhim-core-{current_version}.x86_64.rpm
sudo systemctl start openhim-core
curl https://localhost:8080/heartbeat -k
```

Note: In order for openhim-core to run successfully, you'll need to point it to a valid instance of Mongo or install it locally:

```bash
sudo yum install mongodb-org
sudo service mongod start
```

4. How to check the logs?

```bash
sudo systemctl status openhim-core
sudo tail -f -n 100 /var/log/messages
```

5. If everything checks out then extract the RPM package by leaving the VM.

Install Vagrant scp [plugin](https://github.com/invernizzi/vagrant-scp):
```bash
vagrant plugin install vagrant-scp
```

Then copy the file from the VM:

```bash
vagrant scp default:/home/vagrant/rpmbuild/RPMS/x86_64/{filename}.rpm .
```

Contributing
------------

You may view/add issues here: https://github.com/jembi/openhim-core-js/issues

To contibute code, please fork the repository and submit a pull request. The maintainers will review the code and merge it in if all is well.
