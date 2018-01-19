Developing mediators
====================

**OpenHIM mediators** are separate micro services that run independently from the OpenHIM-core and perform additional mediation tasks for a particular use case. The common tasks within a mediator are as follows:

* Message format adaptation - this is the transformation of messages received in a certain format into another format (e.g. HL7 v2 to HL7 v3 or MHD to XDS.b).
* Message orchestration - this is the execution of a business function that may need to call out to other service endpoints on other systems. (e.g. Enriching a message with a client's unique identifier retrieved from a client registry).

Mediators can be built using any platform that is desired (some good options are Apache Camel, Mule ESB, or any language or platform that is a good fit for your needs). The only restriction is that the mediator MUST communicate with the OpenHIM-core in a particular way. There are 3 different types of communication that a mediator can have with the OpenHIM-core. These are [described later](https://github.com/jembi/openhim-core-js/wiki/Creating-an-OpenHIM-mediator#mediator-communication-with-core).

You can also take a look at our handy [mediator yeoman generators](https://github.com/jembi/openhim-mediator-yeoman-generators) to get set-up with scaffolding to start building a mediator. To help you get started we have also created some tutorials that you can find [here](http://openhim.readthedocs.org/en/latest/tutorial/index.html). If you're a java developer, you can also take a look at our [mediator engine](https://github.com/jembi/openhim-mediator-engine-java) for additional documentation.

Suggested mediator structure
----------------------------

For maximum reusability and modifiability, we suggest that mediators be split into a number of sub-components. These sub-components are shown in the diagram bellow. Mediators do not need to follow this structure however it provides some useful benefits. If a mediator is simple and does not need the complexity added by having multiple sub-components it may implement its functionality in which ever way is simplest. If you mediator does not require this, you may skip this section.

![](/_static/mediators/mediator-structure.png)

Each mediator should consist of a **normalisation** sub-components, an **orchestration** sub-component and a **de-normalisation** sub-component. The purpose of each of these are described below.

_Note: These descriptions are taken the [published thesis](http://www.cair.za.net/research/outputs/open-health-information-mediator-architecture-enabling-interoperability-low-middle) of Ryan Crichton: 'The Open Health Information Mediator: an Architecture for Enabling Interoperability in Low to Middle Income Countries'_

### Normalisation sub-component

This sub-component transforms the request message contained within a transaction to a normalised state. This normalised state is called the canonical form for that transaction. After this process the transaction data must be in a consistent and predictable format to allow components following this step to process it in a predictable fashion, no matter what format it arrived in. This process consists of two operations. Firstly, an on-ramp transformation is applied. This ensures that the message is transformed into a form that the HIM can process, thus enabling syntactic interoperability for the transaction. For example, if the transaction arrives from a legacy application that only supported exporting data in a custom XML format, this process would ensure that the XML is transformed into the canonical form that the HIM can understand, such as an HL7 version 2 messages. Secondly, a translation operation is invoked. This operation is responsible for ensuring the codes and code systems used within the transaction are translated to a standard set of vocabulary or clinical terms, called reference terms, that have a common interpretation by other components of the HIM. This could involve a call to a terminology service to translate and verify that the codes used within the transaction are represented in, or are translated to, known reference terms. In this way semantic interoperability between service requesters and providers is achieved.

### Orchestration sub-component

This sub-component is responsible for performing implementation-specific orchestration for the current transaction. The aim of the orchestration component is to execute the received transaction and perform any consequent action(s) required for this transaction. This could include zero or more calls to external services as well as the execution of business logic. This component compiles the response for the executed transaction and returns this to the persistence component which forwards the response to the service requester via the interface component. The calls to external systems should be done in parallel where possible to ensure that the orchestration is done quickly and efficiently as possible.

### De-normalisation sub-component

This sub-component is responsible for transforming or constructing a service request in a format that is understandable to the service provider. This operates similarly to the normalisation component except the operations occur in the reverse order. This approach serves to decouple service providers from the orchestration component, which allows for service providers to be easily modified or replaced with minimal impact on the mediation component.

Separating the mediator into these difference components allows the same orchestration logic to be reused with multiple inbound and outbound message formats. It also allows the normalisation and de-normalisation sub-components to be split out of the mediator and scaled and load balanced independently from it. This is especially useful in high load applications. We recommend that mediation platform such as Mule ESB or Apache Camel be used to ease the construction of such a mediator simpler.

Mediator communication with core
--------------------------------

### Mediator registration

A mediator **MUST** register itself with the OpenHIM-core each time it starts up. The registration process informs the OpenHIM-core of some useful details:

* An identifier and name to associate with the OpenHIM-core
* The hostname or IP address of the mediator
* Default channel configuration that should be applied to the OpenHIM-core that the mediator needs
* The endpoints that the mediator exposes that the OpenHIM can contact it on.

In order to register itself a mediator MUST send an API request to the OpenHIM-core with the following format:

`POST https://<openhim-core_host>:<api_port>/mediators`

with a JSON body that conforms to the following structure:

```js
{
    "urn": "<a unique URN>", // A unique identifier to identify the mediator, this identifier should always stay the same even if the mediator changes (eg. "urn:openhim-mediator:my-awesome-mediator")
    "version": "", // the version of the mediator, if this is incremented the OpenHIM-core will update the channel configuration - expects a semver string
    "name": "", // a human readable name for the mediator
    "defaultChannelConfig": [ // (optional) an array of default channels to add for this mediator
        { ... }, // a channel object as defined by the OpenHIM-core - see https://github.com/jembi/openhim-core-js/blob/master/src/model/channels.js#L69-L134
        { ... }
    ],
    "endpoints": [ // (A minimum of 1 endpoint must be defined) an array of endpoints that the mediator can be contacted on
        { ... }, // a route object as defined by OpenHIM-core - see https://github.com/jembi/openhim-core-js/blob/master/src/model/channels.js#L7-L33
        { ... }
    ],
    "configDefs": [ ... ], // (optional) An array of config definitions of config that can be set in the OpenHIM-console - see https://github.com/jembi/openhim-core-js/blob/master/src/model/mediators.js
    "config": { "<param1>": "<val1>", "<param2>": "<val2>" } // (optional) Default mediator configuration
}
```

The `configDefs` property defines an array of configuration definitions that each describe configuration parameters that could be provided by the user. These configuration parameters could have the following `type` properties:
* `string` - A string of text
* `bigstring` - A string of text that is expected to be large (it will be displayed as a text area on the OpenHIM-console)
* `bool` - A boolean value (true or false)
* `number` - An integer or decimal value
* `option` - A value from a pre-defined list. If this datatype is use then the `values` property MUST also be used. The `values` property specifies an array of possible values for the parameter.
* `map` - Key/value pairs. A map is formatted as an object with string values, e.g. `{ "key1": "value1", "key2": "value2" }`. New key/value pairs can be added dynamically.
* `struct` - A collection of fields that can be of any of type. If a parameter is a struct, then a `template` field MUST be defined. A template is an array with each element defining the individual fields that the struct is made up of. The definition schema is the same as the `configDefs` [schema](https://github.com/jembi/openhim-core-js/blob/master/src/model/mediators.js) with the exception that a struct may not recursively define other structs.
* `password` - A string value representing a password or some other protected information. The value of this type will be masked when returned form the OpenHIM API in all but the `heartbeats` API endpoint to reduce the risk of accidental exposure.

A config definition may also specify an `array` property (boolean). If true, then the config can have an array of values. The elements in the array must be of the specified type, e.g. if the config definition is of type `string`, then the config must be an array of strings.

The OpenHIM-core SHALL respond with a HTTP status of 201 if the mediator registration was successful.
The OpenHIM-core SHALL respond with an appropriate 4xx status if the mediator registration could not be completed due to a bad request.
The OpenHIM-core SHALL respond with an appropriate 5xx status if the mediator registration could not be completed due to server error in the OpenHIM-core.

#### Mediator Config Definition Examples

##### Basic Settings
The following is a config definition for basic server settings:

```js
{
  ...
  "configDefs": [
    {
      "param": "host",
      "displayName": "Host",
      "description": "Server host",
      "type": "string"
    }, {
      "param": "port",
      "displayName": "Port",
      "description": "Server port",
      "type": "number"
    }, {
      "param": "scheme",
      "displayName": "scheme",
      "description": "Server Scheme",
      "type": "option",
      "values": ["http", "https"]
    }
  ]
}
```

Valid config would be:

```js
{
  "host": "localhost",
  "port": 8080,
  "scheme": "http"
}
```

##### Map example
A map is a collection of key/value pairs:

```js
{
  ...
  "configDefs": [
    {
      "param": "uidMappings",
      "displayName": "UID Mappings",
      "type": "map"
    }
  ]
}
```

Valid config would be:

```js
{
  "uidMappings": {
    "value1": "a1b2c3",
    "value2": "d4e5f6",
    "value3": "g7h8i9"
  }
}
```

Note that the keys `value1`, `value2`, etc. were not predefined in the definition. The OpenHIM-console allows users to dynamically add key/value pairs for a map.

##### Struct example
A struct is a grouping of other types:

```js
{
  ...
  "configDefs": [
    {
      "param": "server",
      "displayName": "Target Server",
      "description": "Target Server",
      "type": "struct",
      "template": [
        {
          "param": "host",
          "displayName": "Host",
          "description": "Server host",
          "type": "string"
        }, {
          "param": "port",
          "displayName": "Port",
          "description": "Server port",
          "type": "number"
        }, {
          "param": "scheme",
          "displayName": "scheme",
          "description": "Server Scheme",
          "type": "option",
          "values": ["http", "https"]
        }
      ]
    }
  ]
}
```

Valid config would be:

```js
{
  "server": {
    "host": "localhost",
    "port": 8080,
    "scheme": "http"
  }
}
```

##### Array example
The following is a config definition for a string array:

```js
{
  ...
  "configDefs": [
    {
      "param": "balancerHosts",
      "displayName": "Balancer Hostnames",
      "description": "A list of hosts to load balance between",
      "type": "string",
      "array": true
    }
  ]
}
```

Valid config would be:

```js
{
  "balancerHosts": [
    "192.168.0.1",
    "192.168.0.3",
    "192.168.0.7"
  ]
}
```

Arrays are supported for all types, including structs:

```js
{
  ...
  "configDefs": [
    {
      "param": "balancerHosts",
      "displayName": "Balancer Hostnames",
      "description": "A list of hosts to load balance between",
      "type": "struct",
      "array": true,
      "template": [
        {
          "param": "host",
          "type": "string"
        }, {
          "param": "weight",
          "type": "number"
        }
      ]
    }
  ]
}
```

Valid config would be:

```js
{
  "balancerHosts": [
    {
      "host": "192.168.0.1",
      "weight": 0.6
    }, {
      "host": "192.168.0.3",
      "weight": 0.2
    }, {
      "host": "192.168.0.7",
      "weight": 0.2
    }
  ]
}
```

### Return transaction metadata

A mediator **SHOULD** return a structured object that indicates the response that should be returned to the user as well as metadata about the actions that were performed. The mediator is not required to do this however useful information can be returned to the OpenHIM-core in this way. If a structured response is not returned to the OpenHIM-core then what ever is returned to the OpenHIM-core is passed directly on to the client that made the request.

The structured object should be returned in the HTTP response for each request that the OpenHIM-core forwards to the mediator. If the mediator chooses to return a strucutred response then the mediator MUST return this object with a content-type header with the value: 'application/json+openhim'. If the mediator wants to set a specific content-type to return to the client, they can set this in the response object as a header (see below).

The JSON object returned to the OpenHIM should take the following form:

```js
{
    "x-mediator-urn": "<a unique URN>", //same as the mediator's urn
    "status": "Successful", // (optional) an indicator of the status of the transaction, this can be one of the following: ['Processing', 'Failed', 'Completed', 'Successful', 'Completed with error(s)']
    "response": { ... }, // a response object as defined by OpenHIM-core - see https://github.com/jembi/openhim-core-js/blob/8264a9b7c81a05853c20cd071e379d23d740dd33/src/model/transactions.coffee#L13-L18
    "orchestrations": [ // (optional) an array of orchestration objects
        { ... }, // orchestration object as defined by OpenHIM-core - see https://github.com/jembi/openhim-core-js/blob/8264a9b7c81a05853c20cd071e379d23d740dd33/src/model/transactions.coffee#L28-L32
        { ... }
    ],
    "properties": { // (optional) a map of properties that the mediator may want to report
        "pro1": "val",
        "pro2": "val"
    },
    "error": { // (optional) if an internal server error occurs, details can be included here. If included the transaction will automatically be retried by the OpenHIM-core, if enabled on the channel.
        "message": "Error message",
        "stack": "...stack trace..." (optional)
    }
}
```

#### Including error details

See the response format above; error details can be included using the `error` field. Although optional, its use is encouraged whenever any internal server errors occur, especially if the connection to an upstream server fails. When included, the OpenHIM will automatically retry the transaction, if the auto-retry option enabled on the channel.

Error details can also be included for orchestrations; see https://github.com/jembi/openhim-core-js/blob/master/src/model/transactions.js#L34

### (Optional) Send heartbeats and recieve user configuration directly from OpenHIM-core

A mediator **MAY** opt to send heartbeats to the OpenHIM-core to demonstrate its aliveness. The heartbeats also allow it to recieve user specified configuration data and any changes to that configuration in a near real-time fashion.

The mediator can do this by utilising the mediator heartbeats API endpoint of the OpenHIM-core. You can find [details on this endpoint here](./api-ref.html#mediator-heartbeat-endpoint). This API endpoint, if supported by the medaitor, should always be called once at mediator startup using the `config: true` flag to get the initial startup config for the mediator if it exists. There after the API endpoint should be hit at least every 30s (a good number to work with is every 10s) by the mediator to provide the OpenHIM-core with its heartbeat and so that the medaitor can recieve the latest user config as it becomes available.
