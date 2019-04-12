# Changelog

## v5.2.0 / 2019-02-19

* Handle authentication types when supplied as a JSON string. This allows the authentication types to be configured through environment variables.

## v5.1.0 / 2019-02-18

* Support basic authentication for the API. This is disabled by default to maintain the existing behaviour but can be enabled via configuration (under `api.authenticationTypes`).

## v5.0.0 / 2019-02-04

### Final stable release

## v5.0.0-rc.2 / 2019-01-22

### Release candidate version bump due to incorrectly released version

An incorrect version has been released which required this release version bump. Re-built the package-lock file to generate latest package dependencies

## v5.0.0-rc.1 / 2019-01-18

### Release candidate with various bug fixes / code refactoring and dependency upgrades

#### Bug Fixes

* Fix channel filtering for non-admins
* Handle responses without timestamps
* Updated a metrics check that verifies the timestamp value to check that its a object (Date) instead of a number
  * Replace the verifification mechanism to be instanceof Date instead of typeof
* Add a shebang character to the url of the transaction link
  * Add missing ! to links
* update the 'update' object which is checked when creating metrics so that metrics are created with mediators
* Include time in filter dates
* Determine user access level using channel permission groups (non-admin user can retrieve transaction body when requesting multiple transactions - reporting as no admin user)

#### Code Cleanup

* Don't set secureProtocol - already supported in supported versions of Node.js
* Remove the harmony flag for start up
* Remove the load testing code run by Artillery
* Remove un-used packages
* Remove the declaration of the Log model schema as this is only used within the tests
* Remove package script command that isnt being used
* Remove the use of StatsD
* Remove the out-dated Vagrant script for development

#### Upgrades

* Upgrading of dependencies to latest versions. This ensures that no vulnerabilities exist within the codebase
* Generate new test certificates
* Added workaround for broken dependency in winston logger
* Replace the "mongoose-patch-history" dependency with a version Jembi forked

#### Additional Features / Enhancements

* Reporting utcOffset config variable for setting the timezone of the reports being generated
* update the report template to include full timestamps
  * will vertically align the "from" and "to" timestamps of the report
  * add the "from" and "to" dates to the plain channel report template and also make the requested changes
* Add the roadmap page to OpenHIM docs
* Update supported Node/MongoDB versions to README

#### Internal Refactoring

* Handle promise rejections asynchronously
* Body Culling: Change the time between task running from 5 to 60 minutes
* Don't watch for file changes in production. This is a development feature
* Make MongoDB filter out channel audit change entries logged by the body-culling job
* Clean up transaction status handling
* Ensure mongo connection string is properly encoded when creating the connection
* Ensure the test starts with a clean database to ensure the assertations are correct and valid
* Updated the mongo options object structure to be one level up.
* Updated mongo options to make use of the new URL parser for mongo
* Updated the deprecated mongo functions with the appropriate alternative (.remove / .count / .insert / .ensureIndex)
