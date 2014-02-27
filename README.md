OpenHIM Core Component
======================

The OpenHIM core component is responcible for providing a single entrypoint into a HIE as well as providing a number of key features:

* Point of service application authentication and authorization
* Persistence and audit logging of all message that travel through the OpenHIM
* Routing on messages to the correct service provider (be it an HIM orchestrator for further orchestration or the actual intended service provider)

Note: The OpenHIM core component in this repository is currently in active and early development. It is not yet ready for production use.

Development
-----------

To get started with this repo you will need all the required dependancies. To get them run the following:

`npm install`

This project uses [mocha](http://visionmedia.github.io/mocha/) as a unit testing framework with [should.js](https://github.com/visionmedia/should.js/) for assertions and [sinon.js](http://sinonjs.org/).

To run the unit tests:

`cake test`

You can have the CoffeeScript files in src/ auto compile as you save them by running:

`cake watch`

Running the server
------------------

To run the OpenHIM core component execute:

`node lib/server.js`

Design
------

To see some design docs refer to the OpenHIE wiki pages:

* [High level design](https://wiki.ohie.org/display/SUB/OpenHIE+Interoperability+Layer+design+document)
* [Technical design using node](https://wiki.ohie.org/display/SUB/Design+of+the+Interoperability+Layer+core+using+Node.js)
