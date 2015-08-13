Mediators
=========

What are mediators?
-------------------

OpenHIM mediators are separate micro services that run independently to the OpenHIM and perform additional mediation tasks for a particular use case. The common tasks within a mediator are as follows:

*   Message format adaptation - this is the transformation of messages received in a certain format into another format (eg. HL7 v2 to HL7 v3 or MHD to XDS.b).
*   Message orchestration - this is the execution of a business function that may need to call out to one or more other service endpoint on other systems. (eg. Enriching a message with a client's unique identifier retrieved from a client registry then sending the enriched message to a shared health record).

Mediators can be built using any platform that is desired (some good options are pure Java using our mediator engine, Node.js, Apache Camel, Mule ESB, or any language or platform that is a good fit for your needs). The only restriction is that the mediator MUST communicate with the OpenHIM-core in a particular way ([this is explained further here](https://github.com/jembi/openhim-core-js/wiki/Creating-an-OpenHIM-mediator#mediator-communication-with-core)). A diagram of how mediators fit into the overall OpenHIM architecture can be seen below. [![OpenHIM architecure](http://www.openhim.org/wp-content/uploads/2014/12/OpenHIM-presentation-for-HITRAC.png)](http://www.openhim.org/wp-content/uploads/2014/12/OpenHIM-presentation-for-HITRAC.png)Please see the [documentation available here](https://github.com/jembi/openhim-core-js/wiki/Creating-an-OpenHIM-mediator) for getting started with mediators and see our [tutorials page](http://www.openhim.org/tutorials/ "Tutorials") for specific examples.

## Mediator repository

Here you can find a list of prebuilt mediators for different projects. The most currently used mediators are the OpenHIE mediators, so, if you are interested in OpenHIE you should probably start there. If you have a mediator that you would like listed here, please contact us on the [OpenHIM Implementers mailing list](https://groups.google.com/d/forum/openhim-implementers) and we can add it.

Mediator Types
--------------

### Pass-through

### Adaptor

### Orchestrator

Existing Mediators
------------------
