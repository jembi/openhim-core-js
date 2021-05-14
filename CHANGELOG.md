# Changelog

## v7.0.0 / 2021-05-14

* Deprecated support for out-dated unsupported Nodejs 10
* Included the support of the latest Nodejs LTS version (14 - Fermium)
* Base Docker image has been updated to use Nodejs 14
* Updated node dependencies
* Skipped release major version v6 as that is an alpha prerelease containing experimental streaming features

## v6.0.0-alpha-1 / 2020-06-29

* Routing Refactor - use request streaming

## v5.4.2 / 2021-01-7

* Channel Names were not displaying in the daily and weekly email reports

## v5.4.1 / 2020-11-11

* All the outdated dependencies have been updated to remove most of the vulnerabilities
* A bug fix has also been applied where adding a client for channel was allowed when the clientId and role were the same, however isnt allowed and prevented the record from being updated correctly

## v5.4.0 / 2020-06-29

* JWT authentication - Enable and configure the JWT settings within the OpenHIM config
* Custom Token authentication - Configure the use of custom token within the OpenHIM config. Custom tokens are configured via the specific channel

## v5.2.6 / 2020-01-23

* Deprecated support for out-dated unsupported Nodejs 8
* Included the support of the latest Nodejs LTS version (12 - Erbium)
* Minor test fixes due to new Nodejs version
* Base Docker image has been updated to use Nodejs 12

## v5.2.5 / 2019-12-05

* Fixed issue with pulling data into daily and weekly transaction reports
* Fixed npm scripts for running only unit or only integration tests
* Updated Babel Major version

## v5.2.4 / 2019-11-05

* Dependency Updates

## v5.2.3 / 2019-11-05

* Dependency Updates

## v5.2.2 / 2019-09-11

* Fixed polling channel functionality
* Dependency updates

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
  * Replace the verification mechanism to be `instanceof` **Date** instead of `typeof`
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
* Remove package script command that isn't being used
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
* Ensure the test starts with a clean database to ensure the assertions are correct and valid
* Updated the mongo options object structure to be one level up.
* Updated mongo options to make use of the new URL parser for mongo
* Updated the deprecated mongo functions with the appropriate alternative (.remove / .count / .insert / .ensureIndex)
