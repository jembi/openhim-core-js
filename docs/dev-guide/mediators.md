Developing mediators
====================

**OpenHIM mediators** are separate micro services that run independently to the OpenHIM and perform additional mediation tasks for a particular use case. The common tasks within a mediator are as follows:

* Message format adaptation - this is the transformation of messages received in a certain format into another format (eg. HL7 v2 to HL7 v3 or MHD to XDS.b).
* Message orchestration - this is the execution of a business function that may need to call out to other service endpoint on oother system. (eg. Enriching a message with a client's unique identifier retrieved from a client registry).

Mediators can be built using any platform that is desired (some good options are Apache Camel, Mule ESB, or any language or platform that is a good fit for your needs). The only restriction is that the mediator MUST communicate with the OpenHIM-core in a particular way. There are 3 different types of communication that a mediator can have with the OpenHIM-core. These are [described later](https://github.com/jembi/openhim-core-js/wiki/Creating-an-OpenHIM-mediator#mediator-communication-with-core).

You can also take a look at our handy [mediator yeoman generators](https://github.com/jembi/openhim-mediator-yeoman-generators) to get set-up with scaffolding to start building a mediator. To help you get started we have also created some tutorials that you can find [here](http://www.openhim.org/tutorials/). If you're a java developer, you can also take a look at our [mediator engine](https://github.com/jembi/openhim-mediator-engine-java) for additional documentation.

Suggested mediator structure
----------------------------

For maximum reusability and modifiability, we suggest that mediators be split into a number of sub-components. These sub-components are shown in the diagram bellow. Mediators do not need to follow this structure however it provides some useful benefits. If a mediator is simple and does not need the complexity added by having multiple sub-components it may implement its functionality in which ever way is simplest. If you mediator does not require this, you may skip this section.

![mediator image](https://docs.google.com/drawings/d/1ahvqbO0PPFTk3icP-hWpGQ_dShSE1ztiLcWeh57St-k/pub?w=697&h=569)

Each mediator should consist of a **normalisation** sub-components, a **orchestration** sub-component and a **de-normalisation** sub-component. The purpose of each of these are described below.

_Note: These description are taken the [published thesis](http://www.cair.za.net/research/outputs/open-health-information-mediator-architecture-enabling-interoperability-low-middle) of Ryan Crichton: 'The Open Health Information Mediator: an Architecture for Enabling Interoperability in Low to Middle Income Countries'_

### Normalisation sub-component

This sub-component transforms the request message contained within a transaction to a normalised state. This normalised state is called the canonical form for that transaction. After this process the transaction data must be in a consistent and predictable format to allow components following this step to process it in a predictable fashion, no matter what format it arrived in. This process consists of two operations. Firstly, an on-ramp transformation is applied. This ensures that the message is transformed into a form that the HIM can process, thus enabling syntactic interoperability for the transaction. For example, if the transaction arrives from a legacy application that only supported exporting data in a custom XML format, this process would ensure that the XML is transformed into the canonical form that the HIM can understand, such as an HL7 version 2 message. Secondly, a translation operation is invoked. This operation is responsible for ensuring the codes and code systems used within the transaction are translated to a standard set of vocabulary or clinical terms, called reference terms, that have a common interpretation by other components of the HIM. This could involve a call to a terminology service to translate and verify that the codes used within the transaction are represented in, or are translated to, known reference terms. In this way semantic interoperability between service requesters and providers is achieved.

### Orchestration sub-component


This sub-component is responsible for performing implementation-specific orchestration for the current transaction. The aim of the orchestration component is to execute the received transaction and perform any consequent action(s) required for this transaction. This could include zero or more calls to external services as well as the execution of business logic. This component compiles the response for the executed transaction and returns this to the persistence component which forwards the response to the service requester via the interface component. The calls to external systems should be done in parallel where possible to ensure that the orchestration is done quickly and efficiently as possible.

### De-normalisation sub-component

This sub-component is responsible for transforming or constructing a service request in a format that is understandable to the service provider. This operates in a similar way to the normalisation component except the operations occur in the reverse order. This approach serves to decouple service providers from the orchestration component, which allows for service providers to be easily modified or replaced with minimal impact on the mediation component.

Separating the mediator into these difference components allows the same orchestration logic to be reused with multiple inbound and outbound message formats. It also allows the normalisation and de-normalisation sub-components to be split out of the mediator and scaled and load balanced independently from it. This is especially useful in high load applications. We recommend that mediation platform such as Mule ESB or Apache Camel be used to ease the construction of such a mediator simpler.

Mediator communication with core
--------------------------------

### Mediator registration

A mediator MUST register itself with the OpenHIM core each time it starts up. The registration process informs the OpenHIM core of some useful details:

* An identifier and name to associate with the OpenHIM-core
* The hostname or IP address of the mediator
* Default channel configuration that should be applied to the OpenHIM-core that the mediator needs
* The endpoints that the mediator exposes that the OpenHIM can contact it on.

In order to register itself a mediator MUST send an API request to the OpenHIM-core with the following format:

`POST https://<openhim-core_host>:<api_port>/mediators`

with a body contain the following sample structure:

```
{
    urn: "<a unique URN>", // A unique identifier to identify the mediator, this identifier should always stay the same even if the mediator changes (eg. "urn:openhim-mediator:my-awesome-mediator")
    version: "", // the version of the mediator, if this is incremented the OpenHIM-core will update the channel configuration - expects a semver string
    name: "", // a human readable name for the mediator
    defaultChannelConfig: [ // (optional) an array of default channels to add for this mediator
        { ... }, // a channel object as defined by the OpenHIM-core - see https://github.com/jembi/openhim-core-js/blob/8264a9b7c81a05853c20cd071e379d23d740dd33/src/model/channels.coffee#L23-L56
        { ... }
    ],
    endpoints: [ // (A minimum of 1 endpoint must be defined) an array of endpoints that the mediator can be contacted on
        { ... }, // a route object as defined by OpenHIM-core - see https://github.com/jembi/openhim-core-js/blob/8264a9b7c81a05853c20cd071e379d23d740dd33/src/model/channels.coffee#L5-L15
        { ... }
    ]
}
```

The OpenHIM-core SHALL respond with a HTTP status of 201 if the mediator registration was successful.
The OpenHIM-core SHALL respond with an appropriate 4xx status if the mediator registration could not be completed due to a bad request.
The OpenHIM-core SHALL respond with an appropriate 5xx status if the mediator registration could not be completed due to server error in the OpenHIM-core.

### Return transaction metadata

A mediator SHOULD return a structured object that indicates the response that should be returned to the user as well as metadata about the actions that were performed. The mediator is not required to do this however useful information can be returned to the OpenHIM-core in this way. If a structured response is not returned to the OpenHIM-core then what ever is returned to the OpenHIM-core  is pass directly on to the client that make the request.

The structured object should be returned in the HTTP response for each request that the OpenHIM-core forwards to the mediator. If the mediator chooses to return a strucutred response then the mediator MUST return this object with a content-type header with the value: 'application/json+openhim'. If the mediator wants to set a specific content-type to return to the client, they can set this in the response object as a header (see below).

The JSON object returned to the OpenHIM should take the following form:

```
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
    }
}
```

### Return transaction metrics

:warning: **not yet implemented**

In addition to returning transaction metadata, a mediator MAY return transaction metrics about the transaction that is processes. To do this then a mediator MAY add a metrics object to the structured response object. This metrics object should be populated with any metrics that the mediator wishes to report.

The OpenHIM-core must be be setup to use a metrics service for this function to be used. The metrics object MUST be formatted as follows (see https://github.com/jembi/openhim-core-js/issues/104 for more details):

```
"metrics": {
    "<metric_name>": "62", // for metrics that apply to the entire transaction
    "<orchestration_name>.<metric_name>": "16", // for metrics that apply to a particular orchestration step, the orchestration_name should reference an orchestration in the orchestrations object
    ...
}
```

If you have any questions that are not covered in this guide, please [submit an issue](https://github.com/jembi/openhim-console/issues/new) with the 'documentation' label and we will strive to add it to this page.