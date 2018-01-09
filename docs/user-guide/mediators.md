Mediators
=========

OpenHIM mediators are separate micro services that run independently to the OpenHIM and perform additional mediation tasks for a particular use case. The common tasks within a mediator are as follows:

*   Message format adaptation - this is the transformation of messages received in a certain format into another format (eg. HL7 v2 to HL7 v3 or MHD to XDS.b).
*   Message orchestration - this is the execution of a business function that may need to call out to one or more other service endpoint on other systems. (eg. Enriching a message with a client's unique identifier retrieved from a client registry then sending the enriched message to a shared health record).

Mediators can be built using any platform that is desired (some good options are pure Java using our mediator engine, Node.js, Apache Camel, Mule ESB, or any language or platform that is a good fit for your needs). The only restriction is that the mediator MUST communicate with the OpenHIM-core in a particular way. Mediators must register themselves with the OpenHIM-core, accept request from the OpenHIM-core and return a specialised response to the OpenHIM-core to explain what that mediator did. A diagram of how mediators fit into the overall OpenHIM architecture can be seen below. ![OpenHIM architecture](/_static/mediators/mediators-overview.png)

If you are interested in developing you own mediators see the [documentation available here](../dev-guide/mediators.html) and see our [tutorials page](../tutorial/index.html "Tutorials") for specific examples to get you started.

Mediator Types
--------------

There are a few common types of mediators, these are described below.

### Pass-through mediator

A Pass-through mediator just accepts a request and passes it on unchanged, these are not very useful and are only really used as a starting point for development.

### Adaptor mediator

An Adaptor mediators accept a request and transform/adapt that request into another format before sending the request on to its final destination.

### Orchestration mediator

An Orchestration mediator accepts a request and uses that request to execute some business process. This could involve making webservice calls to one or more other services to gather additional information about the request or to process it further. Finally a response is collated and returned to the OpenHIM.

Installing Mediators
--------------------

Mediators may be developed in any language and only talk to the OpenHIM via its RESTful API. Therefore, the installation instructions will differ for each mediator. Please refer to the documentation of that mediator to details on how to install it. However, there are a few points that apply to all mediators:

* Mediators DO NOT have to be installed on the same server and the OpenHIM.
* You should ensure that the mediator is able to reach the OpenHIM-core servers RESTful API endpoint.
* You should ensure that the OpenHIM is able to reach the mediator's endpoint for recieving requests.
* You should ensure that you configure the mediator with correct credentials so that it may access the OpenHIMs RESTful API as an admin user.
* You should ensure that the mediator trust the OpenHIM-core's certificate (if it is self signed) as API communication MUST take place over https.

Existing Mediators
------------------

To find some existing mediators we suggest [searching github for "openhim-mediator"](https://github.com/search?utf8=%E2%9C%93&q=%22openhim-mediator%22&type=Repositories&ref=searchresults) which is the naming convension for OpenHIM mediators. For more information on writing you own mediator [click here](../dev-guide/mediators.html).
