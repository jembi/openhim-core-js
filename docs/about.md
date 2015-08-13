About the OpenHIM
=================

OpenHIM stands for the Open Health Information Mediator. The OpenHIM is an interoperability layer: a software component that eases integration between disparate information systems by connecting client and infrastructure components together. Its role is to provide a facade to client systems - providing a single point-of-control for defining web service APIs and adapting and orchestrating requests between infrastructure services. The OpenHIM also provides security, client management and transaction monitoring. The OpenHIM was initially developed as part of the [Rwandan Health Enterprise Architecture](https://jembiprojects.jira.com/wiki/display/RHEAPILOT/Home) project in collaboration with the [University of KwaZulu-Natal](http://heal.cs.ukzn.ac.za/) and was further developed as part of the OpenHIE initiative, where it serves as an interoperability layer reference implementation. The OpenHIM tool is also supported through various implementation projects that continue to support its growth to meet real world needs and project requirements.

## But, what does the HIM do?

The core functions that it provides to allow this to happen are explained below.

*   Allow interoperability between many, different systems
*   Adapt and scale within a changing environment
*   Ensure systems can be developed independently and not affect the functioning of the other systems in the HIE.
*   Provide a low barrier to entry to connect new and legacy systems

To accomplish these functions it does the following things:

*   It exposes a simple API that allows transaction to be performed against the infrastructure services without the client application having to know the complexities of the service's API.
*   It provides Normalization and De-Normalization functions that allow the messages to be transformed into formats that the service requesters (eg. OpenMRS and RapidSMS) and the service providers (eg. CR, PR, SHR and TS) can understand.
*   It orchestrates the transaction. This means it makes the calls to all the service providers that need to participate in this transaction.

The OpenHIM is split into two logical parts:

1. The core
2. The mediators

The core performs common functions that are useful for a SOA environment. It provides an interface that point of service application (clients) are able to contact in order to reach the services provided in the SOA. You can think of this interface as a reverse proxy for your applications but with some special features. These features include:

* Access control - defaults to mutual TLS (client and server certificates) but can also be set to basic auth
* Every request and response is stored for accountability
* Metrics are calculated to give an indication of how the SOA is running
* Support for HTTP request or plain sockets
* Multi-casting of requests to multiple endpoints

The mediators are optional, pluggable services that can add implementation specific functionality to the OpenHIM. These are often used for the following two use cases:

* Message format adaptation - this is the transformation of messages received in a certain format into another format (eg. HL7 v2 to HL7 v3 or MHD to XDS.b).
* Message orchestration - this is the execution of a business function that may need to call out to other service endpoint on oother system. (eg. Enriching a message with a client's unique identifier retrieved from a client registry).

For more information about getting started creating mediators, see: https://github.com/jembi/openhim-core-js/wiki/Creating-an-OpenHIM-mediator

The OpenHIM-console provides an easy to use user interface for managing an OpenHIM server. Find more information about the OpenHIM-console here: https://github.com/jembi/openhim-console

OpenHIM terminology
-------------------

* Client - a point of service application that sends request to the OpenHIM server so that they can be authorised and passed on to the appropriate service within the SOA.
* Channel - a channel holds configuration that matches certain request received on the OpenHIM interface (usually by a certain URL pattern). The channel contains information like what routes to send the request to (there can be multiple of these per channel) and who has access to send request to this channel
* Route - a description of an endpoint to forward requests to.

If you have any questions that are not covered in this guide, please [submit an issue](https://github.com/jembi/openhim-console/issues/new) with the 'documentation' label and we will strive to add it to this page.

## Funders:

[![pepfar](http://www.openhim.org/wp-content/uploads/2014/11/pepfar.jpg)](http://www.pepfar.gov/ "PEPFAR")[![cdc](http://www.openhim.org/wp-content/uploads/2014/11/cdc.jpg)](http://www.cdc.gov/ "CDC")[![idrc](http://www.openhim.org/wp-content/uploads/2014/11/idrc.jpg)](http://www.idrc.ca/EN/Pages/default.aspx "IDRC")[![rockefellerFoundation](http://www.openhim.org/wp-content/uploads/2014/11/rockefellerFoundation.jpg)](http://www.rockefellerfoundation.org/ "Rockefeller Foundation")

## Development Partners:

[![heal](http://www.openhim.org/wp-content/uploads/2014/11/heal.png)](http://heal.cs.ukzn.ac.za/ "HeAL UKZN")

## Partners:

[![mohawk](http://www.openhim.org/wp-content/uploads/2014/11/mohawk.jpg)](http://www.mohawkcollege.ca/ "Mohawk College")[![regenstriefInstitute](http://www.openhim.org/wp-content/uploads/2014/11/regenstriefInstitute.jpg)](http://www.regenstrief.org/ "Regenstrif Institute")[![intraHealth](http://www.openhim.org/wp-content/uploads/2014/11/intraHealth.jpg)](http://www.intrahealth.org/ "InntraHealth")[![hisp](http://www.openhim.org/wp-content/uploads/2014/11/hisp.png)](http://hisp.org)[eCGroup](http://www.ecgroupinc.com/index.htm "eCGroup")

[![jembi](http://www.openhim.org/wp-content/uploads/2014/11/jembi.png)](http://jembi.org)[![openhie-logo](http://www.openhim.org/wp-content/uploads/2014/11/openhie-logo.png)](http://ohie.org)