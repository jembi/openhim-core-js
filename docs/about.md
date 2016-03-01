About the OpenHIM
=================

OpenHIM stands for the Open Health Information Mediator. The OpenHIM is an interoperability layer: a software component that eases integration between disparate information systems by connecting client and infrastructure components together. Its role is to provide a facade to client systems - providing a single point-of-control for defining web service APIs and adapting and orchestrating requests between infrastructure services. The OpenHIM also provides security, client management and transaction monitoring.

The OpenHIM was initially developed as part of the [Rwandan Health Enterprise Architecture](https://jembiprojects.jira.com/wiki/display/RHEAPILOT/Home) project in collaboration with the [University of KwaZulu-Natal](http://heal.cs.ukzn.ac.za/) and was further developed as part of the OpenHIE initiative, where it serves as an interoperability layer reference implementation. The OpenHIM tool is also supported through various implementation projects that continue to support its growth to meet real world needs and project requirements.

## Ok. But, what does the HIM actually do?

The OpenHIM is split into two logical parts:

1. The core
2. Optional mediators

The OpenHIM-core performs common functions that are useful for a SOA environment. It provides an interface that point of service application (clients) are able to contact in order to reach the services provided in the SOA. You can think of this interface as a reverse proxy for your applications but with some special features. These features include:

* Access control - defaults to mutual TLS (client and server certificates) but can also be set to basic auth
* Every request and response is stored for accountability
* Metrics are calculated to give an indication of how the SOA is running
* Support for HTTP request, plain sockets or MLLP sockets
* Multi-casting of requests to multiple endpoints

The mediators are optional, pluggable services that can add extended specific functionality to the OpenHIM. These are often used for the following types of use cases:

* Message format adaptation - this allows the transformation of messages received in a certain format into another format (eg. HL7 v2 to HL7 v3 or MHD to XDS.b).
* Message orchestration - this allows the execution of a business process that may need to call out to other service endpoint on other system. (eg. Enriching a message with a client's unique identifier retrieved from a client registry).

The OpenHIM-core provides a framework to add and mange your own implementation specific mediators in the system.

The OpenHIM also comes with an admin console which provides a user friendly interface for configuring and managing an OpenHIM instance.

If you want to install and implement the OpenHIM, see the [getting started](/getting-started.html) section and the [user guide](/user-guide/index.html) for information on how to get setup and how to configure the system using the OpenHIM console.

## Roadmap

To see the roadmap for the OpenHIM you can view the [issues list for core](https://github.com/jembi/openhim-core-js/issues) and [for console](https://github.com/jembi/openhim-console/issues). When a release is being worked on we try to maintain a milestone for that release. You can see core milestones [here](https://github.com/jembi/openhim-core-js/milestones) and console milestones [here](https://github.com/jembi/openhim-console/milestones). To view what went into our latest releases, have a look at our releases pages. [Core releases](https://github.com/jembi/openhim-core-js/releases) and [console releases](https://github.com/jembi/openhim-console/releases).

## Funders

[![pepfar](/_static/funders/pepfar.jpg)](http://www.pepfar.gov/ "PEPFAR")
[![cdc](/_static/funders/cdc.jpg)](http://www.cdc.gov/ "CDC")
[![idrc](/_static/funders/idrc.jpg)](http://www.idrc.ca/EN/Pages/default.aspx "IDRC")

[![rockefellerFoundation](/_static/funders/rockefellerFoundation.jpg)](http://www.rockefellerfoundation.org/ "Rockefeller Foundation")

## Development Partners

[![jembi](/_static/funders/jembi.png)](http://jembi.org)
[![heal](/_static/funders/heal.png)](http://heal.cs.ukzn.ac.za/ "HeAL UKZN")

## Other Partners

[![mohawk](/_static/funders/mohawk.jpg)](http://www.mohawkcollege.ca/ "Mohawk College")
[![regenstriefInstitute](/_static/funders/regenstriefInstitute.jpg)](http://www.regenstrief.org/ "Regenstrief Institute")
[![intraHealth](/_static/funders/intraHealth.jpg)](http://www.intrahealth.org/ "InntraHealth")

[![hisp](/_static/funders/hisp.png)](http://hisp.org)
[![openhie-logo](/_static/funders/openhie-logo.png)](http://ohie.org)
[**eCGroup**](http://www.ecgroupinc.com/index.htm "eCGroup")
