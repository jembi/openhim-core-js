# OpenHIM Core Component

[![Build Status](https://travis-ci.org/jembi/openhim-core-js.png?branch=master)](https://travis-ci.org/jembi/openhim-core-js) [![Dependency Status](https://david-dm.org/jembi/openhim-core-js.png)](https://david-dm.org/jembi/openhim-core-js) [![devDependency Status](https://david-dm.org/jembi/openhim-core-js/dev-status.png)](https://david-dm.org/jembi/openhim-core-js#info=devDependencies) [![codecov](https://codecov.io/gh/jembi/openhim-core-js/branch/master/graph/badge.svg)](https://codecov.io/gh/jembi/openhim-core-js)

The OpenHIM core component is responsible for providing a single entry-point into an HIE as well as providing the following key features:

- Point of service client authentication and authorization
- Persistence and audit logging of all messages that flow through the OpenHIM
- Routing of messages to the correct service provider (be it an HIM orchestrator for further orchestration or the actual intended service provider)

> **To get started and to learn more about using the OpenHIM** see [the full documentation](http://openhim.org).

Some of the important information is repeated here, however, the above documentation is much more comprehensive.

See the [development road-map](http://openhim.org/docs/introduction/roadmap) for more details on what is to come!

---

## Requirements

Currently supported versions of NodeJS LTS are

| NodeJS (LTS) | MongoDB                    |
| ------------ | -------------------------- |
|  14.2x.x     | >= 3.6 &#124;&#124; <= 4.2 |
|  15.x        | >= 3.6 &#124;&#124; <= 4.2 |


- [NodeJS Release Versions](https://github.com/nodejs/Release)
- [MongoDB NodeJS Driver Versions](https://mongodb.github.io/node-mongodb-native/)
- [MongoDB Driver Compatibility](https://docs.mongodb.com/ecosystem/drivers/driver-compatibility-reference/#node-js-driver-compatibility)

## Getting started with the OpenHIM-core

### Docker Compose

1. Ensure that you have [Docker](https://docs.docker.com/install/) and [Docker Compose](https://docs.docker.com/compose/install/) installed.
1. Navigate to the [docker-compose.yml](https://github.com/jembi/openhim-core-js/blob/master/infrastructure/docker-compose.yml) file found in the `/infrastructure` directory.
1. Execute the Docker Compose file to pull the docker images and start the services in a detached mode:

  ```sh
  docker-compose up -d
  ```

1. Once the services have all started, you will be able to view the [OpenHIM Console](http://localhost:9000) in your browser.

---

## Developer guide

Clone the `https://github.com/jembi/openhim-core-js.git` repository.

Ensure you have the following installed:

- [Node.js](http://nodejs.org/) **v10(LTS) && != 10.15.1 || v12(LTS)**
- [NPM](https://www.npmjs.com/)
- [MongoDB](http://www.mongodb.org/) (in Ubuntu run `sudo apt install mongodb`, in OSX using [Homebrew](http://brew.sh), run `brew update` followed by `brew install mongodb`)

Navigate to the directory where the openhim-core-js source is located and run the following:

`npm install`

> This will install all the required modules and then build the project files.

In order to run the OpenHIM core server, [MongoDB](http://www.mongodb.org/) must be installed and running. Please refer to the [requirements table](#requirements) for accurate versions to use.

To run the server, execute:

`npm start` (this runs `node lib/server.js` behind the scenes)

The server will by default start in development mode using the mongodb database 'openhim-development'. To start the server in production mode use the following:

`NODE_ENV=production npm start`

This starts the server with production defaults, including the use of the production mongodb database called 'openhim'.

This project uses [mocha](https://mochajs.org/) as a unit testing framework with [should.js](https://github.com/visionmedia/should.js/) for assertions and [sinon.js](http://sinonjs.org/) for spies and mocks. The tests can be run using `npm test`.

**Pro tips:**

- `npm run lint` - ensure the code is lint free, this is also run before an `npm test`
- `npm link` - will symlink you local working directory to the globally installed openhim-core module. Use this so you can use the global openhim-core binary to run your current work in progress. Also, if you build any local changes the server will automatically restart.
- `npm test -- --grep <regex>` - will only run tests with names matching the regex.
- `npm test -- --inspect` - enabled the node debugger while running unit tests. Add `debugger` statements and use `node debug localhost:5858` to connect to the debugger instance.
- `npm test -- --bail` - exit on first test failure.

---

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

1. [Optional] The Vagrant file provisions the VM with the latest source code from master and attempts to compile the RPM package for you. However in the event an error occurs, or if you prefer to have manual control over the process, then you'll need to do the following:

   - Remote into the VM: `vagrant ssh`
   - Download or sync all source code into VM.
   - Ensure all dependencies are installed.

   ```bash
   npm i && npm i speculate
   ```

   - Run speculate to generate the SPEC files needed to build the RPM package.

   ```bash
   npm run spec
   ```

   - Ensure the directory with the source code is linked to the rpmbuild directory - the folder RPMBUILD will use.

   ```bash
   ln -s ~/openhim-core ~/rpmbuild
   ```

   - Build RPM package.

   ```bash
   rpmbuild -bb ~/rpmbuild/SPECS/openhim-core.spec
   ```

1. Install & Test package

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

1. How to check the logs?

   ```bash
   sudo systemctl status openhim-core
   sudo tail -f -n 100 /var/log/messages
   ```

1. If everything checks out then extract the RPM package by leaving the VM.

   Install Vagrant scp [plugin](https://github.com/invernizzi/vagrant-scp):

   ```bash
   vagrant plugin install vagrant-scp
   ```

   Then copy the file from the VM:

   ```bash
   vagrant scp default:/home/vagrant/rpmbuild/RPMS/x86_64/{filename}.rpm .
   ```

---

## Contributing

You may view/add issues here: <https://github.com/jembi/openhim-core-js/issues>

To contribute code, please fork the repository and submit a pull request. The maintainers will review the code and merge it in if all is well.

## Data Privacy Disclaimer

All users downloading and using OpenHIM should note the following:

* All message data sent to the OpenHIM is retained indefinitely within the OpenHIM’s MongoDB database. By default, this data is stored indefinitely in line with the function of a middleware software with audit & transaction replay capabilities.
* All message data is stored in OpenHIM's MongoDB and is only accessible or viewable by a) An authorized admin-level user or a user that has been explicitly allowed to do so or; b) An authorized system administrator staff member having access to the server itself.
* Access to the message data stored in OpenHIM’s MongoDB database is controlled by the organization hosting OpenHIM. This organisation must know its responsibilities as a ‘Data Controller’ and potentially other roles, as defined in standard data privacy regulations, such as the General Data Protection Regulation (GDPR) and the South African Protection of Personal Information Act (POPIA). The organisation using OpenHIM is responsible for having the required policies in place to ensure compliance with the applicable laws and regulations in the country where the software is being operated.
* All message data stored in OpenHIM's MongoDB may be purged at any time by direct commands to the MongoDB database or the use of the data retention feature of OpenHIM channels.
* Basic data about OpenHIM users (name and email) is stored indefinately so that they may access the OpenHIM console. These users may be removed at any time if they are no longer needed.
