About the OpenHIM
=================

OpenHIM stands for the Open Health Information Mediator. The OpenHIM is an interoperability layer: a software component that eases integration between disparate information systems by connecting client and infrastructure components together. Its role is to provide a facade to client systems - providing a single point-of-control for defining web service APIs and adapting and orchestrating requests between infrastructure services. The OpenHIM also provides security, client management and transaction monitoring.

The OpenHIM was initially developed as part of the [Rwandan Health Enterprise Architecture](https://jembiprojects.jira.com/wiki/display/RHEAPILOT/Home) project in collaboration with the [University of KwaZulu-Natal](http://heal.cs.ukzn.ac.za/) and was further developed as part of the OpenHIE initiative, where it serves as an interoperability layer reference implementation. The OpenHIM tool is also supported through various implementation projects that continue to support its growth to meet real world needs and project requirements.

## Ok. But, what does the HIM actually do?

The OpenHIM is split into two logical parts:

1. The core
2. Optional mediators

The core performs common functions that are useful for a SOA environment. It provides an interface that point of service application (clients) are able to contact in order to reach the services provided in the SOA. You can think of this interface as a reverse proxy for your applications but with some special features. These features include:

* Access control - defaults to mutual TLS (client and server certificates) but can also be set to basic auth
* Every request and response is stored for accountability
* Metrics are calculated to give an indication of how the SOA is running
* Support for HTTP request, plain sockets or MLLP sockets
* Multi-casting of requests to multiple endpoints

The mediators are optional, pluggable services that can add extended specific functionality to the OpenHIM. These are often used for the following types of use cases:

* Message format adaptation - this allows the transformation of messages received in a certain format into another format (eg. HL7 v2 to HL7 v3 or MHD to XDS.b).
* Message orchestration - this allows the execution of a business process that may need to call out to other service endpoint on other system. (eg. Enriching a message with a client's unique identifier retrieved from a client registry).

The OpenHIM core provides a framework to add and mange your own implementation specific medaiators in the system.

The OpenHIM also comes with an admin console. This admin console provides an easy to use user interface for configuring and managing an OpenHIM server.

If you want to install and implement the OpenHIM, see the user guide for information on how to get setup and how to configure the system using the OpenHIM console.

## Funders

[![pepfar](http://www.openhim.org/wp-content/uploads/2014/11/pepfar.jpg)](http://www.pepfar.gov/ "PEPFAR")[![cdc](http://www.openhim.org/wp-content/uploads/2014/11/cdc.jpg)](http://www.cdc.gov/ "CDC")[![idrc](http://www.openhim.org/wp-content/uploads/2014/11/idrc.jpg)](http://www.idrc.ca/EN/Pages/default.aspx "IDRC")[![rockefellerFoundation](http://www.openhim.org/wp-content/uploads/2014/11/rockefellerFoundation.jpg)](http://www.rockefellerfoundation.org/ "Rockefeller Foundation")

## Development Partners

[![heal](http://www.openhim.org/wp-content/uploads/2014/11/heal.png)](http://heal.cs.ukzn.ac.za/ "HeAL UKZN")

## Partners

[![mohawk](http://www.openhim.org/wp-content/uploads/2014/11/mohawk.jpg)](http://www.mohawkcollege.ca/ "Mohawk College")[![regenstriefInstitute](http://www.openhim.org/wp-content/uploads/2014/11/regenstriefInstitute.jpg)](http://www.regenstrief.org/ "Regenstrif Institute")[![intraHealth](http://www.openhim.org/wp-content/uploads/2014/11/intraHealth.jpg)](http://www.intrahealth.org/ "InntraHealth")[![hisp](http://www.openhim.org/wp-content/uploads/2014/11/hisp.png)](http://hisp.org)[eCGroup](http://www.ecgroupinc.com/index.htm "eCGroup")

[![jembi](http://www.openhim.org/wp-content/uploads/2014/11/jembi.png)](http://jembi.org)[![openhie-logo](http://www.openhim.org/wp-content/uploads/2014/11/openhie-logo.png)](http://ohie.org)