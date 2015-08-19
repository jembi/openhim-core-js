Mediators
=========

What are mediators?
-------------------

OpenHIM mediators are separate micro services that run independently to the OpenHIM and perform additional mediation tasks for a particular use case. The common tasks within a mediator are as follows:

*   Message format adaptation - this is the transformation of messages received in a certain format into another format (eg. HL7 v2 to HL7 v3 or MHD to XDS.b).
*   Message orchestration - this is the execution of a business function that may need to call out to one or more other service endpoint on other systems. (eg. Enriching a message with a client's unique identifier retrieved from a client registry then sending the enriched message to a shared health record).

Mediators can be built using any platform that is desired (some good options are pure Java using our mediator engine, Node.js, Apache Camel, Mule ESB, or any language or platform that is a good fit for your needs). The only restriction is that the mediator MUST communicate with the OpenHIM-core in a particular way ([this is explained further here](https://github.com/jembi/openhim-core-js/wiki/Creating-an-OpenHIM-mediator#mediator-communication-with-core)). A diagram of how mediators fit into the overall OpenHIM architecture can be seen below. [![OpenHIM architecure](http://www.openhim.org/wp-content/uploads/2014/12/OpenHIM-presentation-for-HITRAC.png)](http://www.openhim.org/wp-content/uploads/2014/12/OpenHIM-presentation-for-HITRAC.png)Please see the [documentation available here](https://github.com/jembi/openhim-core-js/wiki/Creating-an-OpenHIM-mediator) for getting started with mediators and see our [tutorials page](http://www.openhim.org/tutorials/ "Tutorials") for specific examples.

Mediator Types
--------------

There are a few different types of mediators, these are described below.

### Pass-through

A Pass-through mediator just accepts a request and passes it on unchanged, these are not very useful and are only really used as a starting point for development.

### Adaptor

An Adaptor mediators accept a request and transform/adapt that request into another format before sending the request on to its final destination.

### Orchestrator

An Orchestrator mediator accepts a request and uses that request to execute some business process. This could involve making webservice calls to one or more other services to gather additional information about the request or to process it further. Finally a response is collated and returned to the OpenHIM.

Existing Mediators
------------------

To find some existing mediators we suggest [searching github for "openhim-mediator"](https://github.com/search?utf8=%E2%9C%93&q=%22openhim-mediator%22&type=Repositories&ref=searchresults). For more information on writing you own mediator see [click here](/dev-guide/mediators.html).