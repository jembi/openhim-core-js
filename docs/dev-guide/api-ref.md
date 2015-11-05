RESTful API
===========

Each and every API call that is made to the OpenHIM has to be authenticated. The authentication mechanism that is used can be fairly complex to work with however it provides decent security.

The authentication mechanism is based on http://stackoverflow.com/a/9387289/588776.

Initial authentication notification
-----------------------------------

The user notifies the API that it wants to use its authenticated service:

```GET https://<server>:8080/authenticate/<user_email>```

If you don't have a user account yet, you can use the root user. The default root user details are as follows:

username: root
password: openhim-password (you should change this on a production installation!)

The server will respond with the salt that was used to calculate the clients passwordHash (during user registration):

```
{
    "salt": "xxx",
    "ts": "xxx"
}
```

You must calculate a passwordhash using the received salt and the supplied user password. `passwordhash = (sha512(salt + password))`

For subsequent requests to the API
----------------------------------

For every request you must add the following additional HTTP headers to the request:

```
auth-username: <username>
auth-ts: <the current timestamp - in the following format '2014-10-20T13:19:32.380Z' - user time must be in sync with server time for request to work>
auth-salt: <random uuid salt that you generate>
auth-token: <= sha512(passwordhash + auth-salt + auth-ts) >
```

The server will authorise this request by calculating sha512(passwordhash + auth-salt + auth-ts) using the passwordhash from its own database and ensuring that:

* this is equal to auth-token
* the auth-ts isn't more than 2 seconds old

If these 2 conditions true the request is allowed.

Example implementations
-----------------------

An example of how this authentication mechanism can implemented for use with curl is show here: https://github.com/jembi/openhim-core-js/blob/master/resources/openhim-api-curl.sh

An example of how this is implemented in the OpenHIM Console see: https://github.com/jembi/openhim-console/blob/master/app/scripts/services/login.js#L12-L39 and https://github.com/jembi/openhim-console/blob/master/app/scripts/services/authinterceptor.js#L20-L50

API Reference
-------------

### Channels resource

Channels represent configuration setting of how to route requests through the OpenHIM.

`https://<server>:<api_port>/channels`

#### Fetch all channels

`GET /channels`

The response status code will be `200` if successful and the response body will contain an array of channel objects. See the [channel schema](https://github.com/jembi/openhim-core-js/blob/master/src/model/channels.coffee).

#### Add a channel

`POST /channels`

with a json body representing the channel to be added. See the [channel schema](https://github.com/jembi/openhim-core-js/blob/master/src/model/channels.coffee).

The response code will be `201` is successful.

#### Fetch a specific channel

`GET /channels/:channelId`

where `:channelId` is the `_id` property of the channel to fetch.

The response status code will be `200` if successful and the response body will contain a channel object. See the [channel schema](https://github.com/jembi/openhim-core-js/blob/master/src/model/channels.coffee).

#### Update a channel

`PUT /channels/:channelId`

where `:channelId` is the `_id` property of the channel to update and with a json body representing the channel updates. See the [channel schema](https://github.com/jembi/openhim-core-js/blob/master/src/model/channels.coffee).

The response code will be `200` if successful.

#### Delete a channel

`DELETE /channels/:channelId`

where `:channelId` is the `_id` property of the channel to delete.

The response code will be `200` if successful.

### Clients resource

Other system that send request for the OpenHIM to forward.

`https://<server>:<api_port>/clients`

#### Fetch all clients

`GET /clients`

The response status code will be `200` if successful and the response body will contain an array of client objects. See the [clients schema](https://github.com/jembi/openhim-core-js/blob/master/src/model/clients.coffee).

#### Add a client

`POST /clients`

with a json body representing the client to be added. See the [clients schema](https://github.com/jembi/openhim-core-js/blob/master/src/model/clients.coffee).

The response code will be `201` is successful.

#### Fetch a specific client

`GET /clients/:clientId`

where `:clientId` is the `_id` property of the client to fetch.

The response status code will be `200` if successful and the response body will contain a client object. See the [client schema](https://github.com/jembi/openhim-core-js/blob/master/src/model/clients.coffee).

#### Fetch a specific client by domain

`GET /clients/domain/:clientDomain`

where `:clientDomain` is the `domain` property of the client to fetch.

The response status code will be `200` if successful and the response body will contain a client object. See the [client schema](https://github.com/jembi/openhim-core-js/blob/master/src/model/clients.coffee).

#### Update a client

`PUT /clients/:clientId`

where `:clientId` is the `_id` property of the client to update.

The response code will be `200` if successful.

#### Delete a client

`DELETE /clients/:clientId`

where `:clientId` is the `_id` property of the client to delete.

The response code will be `200` if successful.

### Users resource

Users of the system.

`https://<server>:<api_port>/users`

#### Fetch all users

`GET /users`

The response status code will be `200` if successful and the response body will contain an array of users objects. See the [user schema](https://github.com/jembi/openhim-core-js/blob/master/src/model/users.coffee).

#### Add a user

`POST /users`

with a json body representing the user to be added. See the [users schema](https://github.com/jembi/openhim-core-js/blob/master/src/model/users.coffee).

The response code will be `201` is successful.

#### Fetch a specific user by email address

`GET /users/:email`

where `:email` is the `email` property of the user to fetch.

The response status code will be `200` if successful and the response body will contain a user object. See the [user schema](https://github.com/jembi/openhim-core-js/blob/master/src/model/users.coffee).

#### Update a user

`PUT /users/:email`

where `:email` is the `email` property of the user to update and with a json body representing the user updates. See the [user schema](https://github.com/jembi/openhim-core-js/blob/master/src/model/users.coffee).

The response code will be `200` if successful.

#### Delete a user

`DELETE /users/:email`

where `:email` is the `email` property of the user to delete.

The response code will be `200` if successful.

### Transactions resource

Transactions store details about request and responses send through specifc channels.

`https://<server>:<api_port>/transactions`

An important concept to grasp with a transaction is the meaning of a transactions status. Here is a description of what each state means:

* Processing - We are waiting for responses from one or more routes
* Successful - The primary route and all other routes returned successful http response codes (2xx).
* Failed - The primary route has returned a failed http response code (5xx)
* Completed - The primary route and the other routes did not return a failure http response code (5xx) but some weren't successful (2xx).
* Completed with error(s) - The primary route did not return a failure http response code (5xx) but one of the routes did.

#### Fetch all transactions

`GET /transactions`

The response status code will be `200` if successful and the response body will contain an array of transaction objects. See the [transaction schema](https://github.com/jembi/openhim-core-js/blob/master/src/model/transactions.coffee).

The following query parameters are supported:
* `filterLimit`: The max number of transactions to return
* `filterPage`: The page to return (used in conjunction with `filterLimit`)
* `filterRepresentation`: Determines how much information for a transaction to return; options are
  * `simple`: minimal transaction information
  * `simpledetails`: minimal transaction information, but with more fields than simple
  * `bulkrerun`: minimal transaction information required in order to determine rerun status
  * `full`: Full transaction information
* `channelID`: Only return transactions that are linked to the specified channel
* `filters`: Advanced filters specified as an object. Transaction fields can be specified based on the [transaction schema](https://github.com/jembi/openhim-core-js/blob/2920608ac3911b1374c9256cd48ad1cfff0626d8/src/model/transactions.coffee#L40-L56). For example, in order to filter by response status 200 and a property called `prop` with a value `val`, the following query could be used: `/transactions?filterLimit=100&filterPage=0&filters=%7B%22response.status%22:%22200%22,%22properties%22:%7B%22prop%22:%22val%22%7D%7D`

#### Add a transaction

`POST /transactions`

with a json body representing the transaction to be added. See the [transactions schema](https://github.com/jembi/openhim-core-js/blob/master/src/model/transactions.coffee).

The response code will be `201` is successful.

#### Fetch a specific transaction

`GET /transactions/:transactionId`

where `:transactionId` is the `_id` property of the user to fetch.

The response status code will be `200` if successful and the response body will contain a transaction object. See the [transaction schema](https://github.com/jembi/openhim-core-js/blob/master/src/model/transactions.coffee).

#### Find transactions by client Id

`GET /transactions/clients/:clientId`

where `:clientId` is the `clientID` property of the client we wish to find transaction for.

The response status code will be `200` if successful and the response body will contain an array of transaction objects. See the [transaction schema](https://github.com/jembi/openhim-core-js/blob/master/src/model/transactions.coffee).

#### Update a transaction

`PUT /transactions/:transactionId`

where `:transactionId` is the `_id` property of the transaction to update and with a json body representing the transaction updates. See the [transaction schema](https://github.com/jembi/openhim-core-js/blob/master/src/model/transactions.coffee).

The response code will be `200` if successful.

#### Delete a transaction

`DELETE /transactions/:transactionId`

where `:transactionId` is the `_id` property of the transaction to delete.

The response code will be `200` if successful.

###Contact groups resource

A contact group (or contact list) defines logical groups of users used for contacting users en masse.

`https://<server>:<api_port>/groups`

#### Fetch all groups

`GET /groups`

The response status code will be `200` if successful and the response body will contain an array of group objects. See the [contact groups schema](https://github.com/jembi/openhim-core-js/blob/master/src/model/contactGroups.coffee).

#### Add a group

`POST /groups`

with a json body representing the group to be added. See the [contact groups schema](https://github.com/jembi/openhim-core-js/blob/master/src/model/contactGroups.coffee).

The response code will be `201` is successful.

#### Fetch a specific group

`GET /groups/:groupId`

where `:groupId` is the `_id` property of the group to fetch.

The response status code will be `200` if successful and the response body will contain a group object. See the [contact group schema](https://github.com/jembi/openhim-core-js/blob/master/src/model/contactGroups.coffee).

#### Update a group

`PUT /groups/:groupId`

where `:groupId` is the `_id` property of the group to update.

The response code will be `200` if successful.

#### Delete a group

`DELETE /groups/:groupId`

where `:groupId` is the `_id` property of the group to delete.

The response code will be `200` if successful.

### Tasks resource

Tasks are used to submit transactions to be re-run.

`https://<server>:<api_port>/tasks`

#### Fetch all tasks

`GET /tasks`

The response status code will be `200` if successful and the response body will contain an array of task objects. See the [tasks schema](https://github.com/jembi/openhim-core-js/blob/master/src/model/tasks.coffee).

#### Add a task

`POST /tasks`

with a json body representing the task to be added in the following format:
```
{
  "tids": [
    "id#1",
    "id#2",
    ...
    "id#N"
  ],
  "batchSize": 4,   //optional
  "paused": true    //optional
}
```

The `tids` field should contain an array of transaction identifiers indicating the transactions that need to be rerun. The `batchSize` field indicates the number of transactions that the core should run concurrently. To prevent a task from immediately starting upon add, the `paused` field can be added. In this case the task will simply be scheduled with a `Paused` status, ready to be started at any later stage.

The response code will be `201` if successful.

#### Fetch a specific task

`GET /tasks/:taskId`

where `:taskId` is the `_id` property of the task to fetch.

The response status code will be `200` if successful and the response body will contain a task object. See the [task schema](https://github.com/jembi/openhim-core-js/blob/master/src/model/tasks.coffee).

#### Update a task

`PUT /tasks/:taskId`

where `:taskId` is the `_id` property of the task to update.

Tasks can be paused, resumed or cancelled by sending through an update with status equal to `Paused`, `Queued` or `Cancelled` respectively.

The response code will be `200` if successful.

#### Delete a task

`DELETE /tasks/:taskId`

where `:taskId` is the `_id` property of the task to delete.

The response code will be `200` if successful.

### Mediators

`https://<server>:<api_port>/mediators`

#### Fetch all mediators

`GET /mediators`

The response status code will be `200` if successful and the response body will contain an array of mediator objects. See the [mediators schema](https://github.com/jembi/openhim-core-js/blob/master/src/model/mediators.coffee).

#### Add a mediator

`POST /mediators`

with a json body representing the mediator to be added. See the [mediators schema](https://github.com/jembi/openhim-core-js/blob/master/src/model/mediators.coffee).

The response code will be `201` is successful.

#### Fetch a specific mediator

`GET /mediators/:urn`

where `:urn` is the `urn` property of the mediator to fetch.

The response status code will be `200` if successful and the response body will contain a mediator object. See the [mediator schema](https://github.com/jembi/openhim-core-js/blob/master/src/model/mediators.coffee).

#### Mediator heartbeat endpoint

This endpoint allows a mediator to send a heartbeat to the OpenHIM-core. This serves two purposes:

1. It allows the mediator to demonstrate its alive-ness and submit an uptime property
2. It allows the mediator to fetch the latest configuration from the OpenHIM-core

This endpoint only returns mediator config if the config has changed between the time the previous heartbeat was received and the current time. You may force the endpoint to return the latest config via the `config: true` property.

`POST /mediators/:urn/heartbeat`

where `:urn` is the `urn` property of the mediator that is sending in a heartbeat.

with an http body of:

```js
{
  "uptime": 50.25 // The uptime is seconds
  "config": true // (Optional) a flag to force the OpenHIM-core to send back the latest config
}
```

The response will always have a `200` status if successful or a `404` if the mediator specified by the urn cannot be found. The response body will contain the latest mediator config that has been set on the OpenHIM-core server only if the config has changed since the last time a heartbeat was received from this mediator. Otherise, the response body is left empty.

This endpoint can only be called by an admin user.

#### Set mediator config

Sets the current configuration values for this mediator. The received configuration must conform to the configuration definition that the mediator defined in its registration message.

`POST /mediators/:urn/config`

where `:urn` is the `urn` property of the mediator that is sending in it heartbeat.

with an http body of:

```js
{
  paramName: "value",
  paramName: "value"
}
```

The response will have an http status code of `201` if successful, `404` if the mediator referenced by urn cannot be found and `400` if the config supplied cannot be validated against the configuration definition supplied in the mediator registration message.

This endpoint can only be called by an admin user.

### Metrics resource

#### Global Metrics

`https://<server>:<api_port>/metrics`

`/metrics`

This fetches global load and transaction duration metrics for all channels that the logged in user has permissions to view.

These are fetched from either aggregating transaction data from MongoDB or from an instance of the statd metrics service. This depends on the configuration of the HIM in question.

`/metrics/status`

This breaks down the global load metrics by channel and buy status, where the status, could either be 'Processing', 'Failed', 'Completed', 'Successful', 'Completed with error(s)'

#### Channel Metrics

`/metrics/[type]/[channelId]

When [type] is status you may expect a response like this

```json
[  
   {  
      "_id":{  
         "channelID":"542530aef4e8c76f482bced9"
      },
      "failed":409,
      "successful":280,
      "processing":0,
      "completed":0,
      "completedWErrors":0
   }
]
```

When [type] is hour, day, or month you may expect a response like this

```json
[  
   {  
      "load":1118,
      "avgResp":48223.69219653179,
      "timestamp":"2015-02-19T00:00:00.000Z"
   },
   {  
      "load":1725,
      "avgResp":31724.939194741168,
      "timestamp":"2015-02-20T00:00:00.000Z"
   },
   {  
      "load":1710,
      "avgResp":34803.78491859469,
      "timestamp":"2015-02-21T00:00:00.000Z"
   },
   {  
      "load":1580,
      "avgResp":19637.350119904077,
      "timestamp":"2015-02-22T00:00:00.000Z"
   },
   {  
      "load":1637,
      "avgResp":24750.785830618894,
      "timestamp":"2015-02-23T00:00:00.000Z"
   },
   {  
      "load":1704,
      "avgResp":31745.67877786953,
      "timestamp":"2015-02-24T00:00:00.000Z"
   },
   {  
      "load":1828,
      "avgResp":41017.4289276808,
      "timestamp":"2015-02-25T00:00:00.000Z"
   },
   {  
      "load":689,
      "avgResp":37255.648590021694,
      "timestamp":"2015-02-26T00:00:00.000Z"
   }
]
```

If you have any questions that are not covered in this guide, please [submit an issue](https://github.com/jembi/openhim-core-js/issues/new) with the 'documentation' label and we will strive to add it to this page.

### Keystore resource

The keystore resource allows you to set and fetch the server certificate and key and set and query trusted certificates.

#### Get the current HIM server cert

`GET keystore/cert`

returns 200 ok with `{ subject: '', issuer: '', validity: '', cert: '<pem string>' }`

#### Gets the array of trusted ca certs

`GET keystore/ca`

returns 200 ok with `[ { subject: '', issuer: '', validity: '', cert: '<pem string>' }, ... ]`

#### gets a ca cert by its _id

`GET keystore/ca/_id`

returns 200 ok with `{ subject: '', issuer: '', validity: '', cert: '<pem string>' }`

#### Sets the HIM server key

`POST keystore/key`

data `{ key: '<pem string>' }`

returns 201 ok

#### Sets the HIM server cert

`POST keystore/cert`

data `{ cert: '<pem string>' }`

returns 201 ok

#### Adds a cert to the list of ca certs

`POST keystore/ca/cert`

data `{ cert: '<pem string>' }`

returns 201 ok

#### Removes a ca cert by its _id

`DELETE keystore/ca/_id`

returns 200 ok

#### Queries the validity of the server cert and private key

`GET keystore/validity`

return 200 ok with `{ valid: true|false}`

### Logs resource

The logs resource allows you to get access to the server logs. This resource is only accessible by admin users and only works if you have [database logging](https://github.com/jembi/openhim-core-js/blob/master/config/config.md) enabled (This is enabled by default).

#### Get logs

`GET logs?[filters]`

Fetches server logs. You may apply a number of filters to fetch the logs that you require. By default the logs with level `info` and above for the last 5 mins with be returned. The logs will be returned as an ordered array with the latest message at the end of the array.

A maximum of 100 000 log messages will ever be returned. So don't make unreasonable queries as you won't get all the results (hint: use pagination).

The following filters are available:

* `from` - an ISO8601 formatted date to query from. Defaults to 5 mins ago.
* `until` - an ISO8601 formatted date to query until. Defaults to now.
* `start` - a number n: the log message to start from, if specified the first `n` message are NOT returned. Useful along with limit for pagination. Defaults to 0.
* `limit` - a number n: the max number of log messages to return. Useful along with `start` for pagination. Defaults to 100 000.
* `level` - The log level to return. Possible values are `debug`, `info`, `warn` and `error`. All messages with a level equal to or of higher severity to the specified value will be returned. Defaults to `info`.

The logs will be returned in the following format with a `200` status code:

```js
[
  {
    "label": "worker1",
    "meta": {},
    "level": "info",
    "timestamp": "2015-10-29T09:40:31.536Z",
    "message": "Some message"
  },
  {
    "label": "worker1",
    "meta": {},
    "level": "info",
    "timestamp": "2015-10-29T09:40:39.128Z",
    "message": "Another message"
  }
  // ...
]
```

For example a sample request could look like this:
```
https://localhost:8080/logs?from=2015-10-28T12:31:46&until=2015-10-28T12:38:55&limit=100&start=10&level=error`
```

### Server uptime

`GET heartbeat`

returns 200 ok with `{ master: <core-uptime>, mediators: { <urn>: <mediator-uptime> ... }}`

Returns the server uptime in seconds. Includes a list of all registered mediators and if heartbeats have been received for them, will include their uptimes as well.

Note that this is a public endpoint that does not require any authorization. It is convenient for integrating with external monitoring tools.
