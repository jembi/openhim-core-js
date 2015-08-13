Current Release
---------------

### OpenHIM 1.0.x - Released: 11 November 2014

* A new mediator plugin architecture
* Daily or weekly summary reports
* Enhanced security of the OpenHIM API
* Ability to restrict who can view request and response body
* Transaction correlation ID added to forwarded transactions
* Many Bug fixes

For more details on the issues completed in this release see: https://github.com/jembi/openhim-core-js/issues?q=milestone%3Av1.0.x+is%3Aclosed

Planned releases
----------------

### OpenHIM 1.1.x - ETA: end of February 2015

* Updated landing to page for the tool (OpenHIM.org)
* Add visualizer API
* Restricted/not-stored request and response bodies
* Improved documentation: tutorial and FAQ (see openhim.org)
* Allow the use of a statsd metrics service
* Send new user a registration email
* Allow importing/exporting of channel config
* Release as a npm package for easier installation
* Implement a 'keystore' were a user to can add and manage certificates
* TLS support for MLLP routes
* Enable the server to be restarted via the API
* Support for public channels and better choice of channel authorisation
* Bug fixes and code refactoring

### OpenHIM future releases
* Should we support async routes?
* Allow user to add custom pages with static content, perhaps to explain what their instance does (1 vote)
* Allow routes to be load balanced
* Add default ATNA audit logging
* Incorporate an ATNA audit repository
* Bug fixes

Prior releases
--------------

### OpenHIM 0.2.x - Released: 25 September 2014

* Add channel metrics API
* Add dashboard metrics API
* Support routing to HTTPS endpoints
* Support polling of mediators
* Support receiving data using sockets (for MLLP)
* Bug fixes
* Bug fixes for Liberia

### OpenHIM 0.1 - Released: 11 Aug 2014

* Routing of HTTP requests
* TLS and basic auth authentication of requests
* Authorisation of client access to particular channels
* A management API for managing clients, users and channels
* The ability to queue transactions to be re-run
* Storage of request and response metadata for each transaction received
