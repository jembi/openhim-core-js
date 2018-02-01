About the OpenHIM
====================

The Open Health Information Mediator (OpenHIM) is an interoperability layer: a software component that enables easier interoperability between disparate electronic information systems by providing a central point where the exchange of data is managed. An interoperability layer receives transactions from different information systems and coordinates the interactions between them. The OpenHIM provides a layer of abstraction between systems that allows for the transformation of incoming messages to a form that the other system components expect and can support the business logic by orchestrating the transaction flow. 

The OpenHIM is the current reference technology for the interoperability layer of the OpenHIE (Open Health Information Exchange). It is supported through a number of implementation projects that drive its continuing development to meet real world needs.  

Some examples of common workflows that the OpenHIM can support to facilitate the sharing of health information within a Health Information Exchange are:  
* Save a patient's clinical encounter to a shared health record so that authorised healthcare providers are able to access key clinical data that can inform better care 
* Retrieve relevant information about patient encounters and care plans for authorised healthcare providers
* Receive aggregate reporting information from a client system and send this to an aggregate datastore
* Manage health facilities 
* Manage patient demographics and identity to allow for the tracking of a patient’s activity within and between healthcare  organisations and across the continuum of care

## Ok. But, what does the OpenHIM actually do?

The OpenHIM enables easier interoperability between systems by connecting all of the infrastructure services and client or point of service applications together. In the OpenHIE context, these systems are Health Information Systems (HISs) such as a client registry, provider registry, facility registry, shared health record, terminology service and a data warehouse.  

![OpenHIEArchitecture](/_static/overview/OpenHIEArchitecture.PNG)

The OpenHIM provides a single point of entry into the services of a health information exchange (HIE): it receives transactions from client systems, coordinates interaction between the different components of the HIE by routing requests to the correct orchestrator or registry, and provides the centralised common core functions to simplify data exchange. 

These core functions are:  
* Standardised audit trail logging: each message that is received from a client should be logged (stored in its entirely with metadata) and audited (store key information about that transaction, who created it and when it was created).
* Security Management: authentication and authorisation at a systems level  
* Console: this displays real time transaction details to enable a system administrator to monitor the operations of the HIE
* Error Management: Provides the ability for a system administrator to resolve errors and re-run transactions 

In addition, the OpenHIM can also provide additional mediation functions for transactions within the HIE in order to simplify the business logic required by client systems to interact with the HIE, making it easier and faster for these point of care applications to connect to the HIE. It provides an abstraction layer whereby the mediators can take complex messages and parse them into simpler sub-queries that are then directed to the appropriate registry or other component. The mediators can adapt an incoming request to a form that the intended recipient of the request can understand. Mediators can transform native messages into a standardised format that can be consumed by the registries, data warehouse or other services and thereby enable client systems that do not support a particular data exchange standard to still be able to interact with the HIE. 

The OpenHIM is also able to perform orchestration tasks for complex transactions so as to take the burden off client systems. Examples of orchestration could be the execution of a care plan or the validation of a patient identifier in a message against the Client Registry/Master Patient Index within the HIE. This orchestration may contact multiple service providers within the HIE on a client’s behalf and compile an appropriate response to return to the client. 

## What are the benefits of using the OpenHIM?

The OpenHIM acts as a central exchange that offers the following benefits:
* It is an open source software application, with a zero cost licence (Mozilla Public License (MPL) version 2.0) and a publicly available codebase.
* It provides a single point of control within a Service Oriented Architecture (SOA), enabling: 
* Centralised security management:
* Authentication to confirm a the identity of an individual user or client system
* Authorisation to determine the user or client’s privileges and access levels 
* Centralised certificate management which allows for easier setup and maintenance.
* Easy routing of messages between systems or system components.
* Centralised logging of all messages for auditing and reporting. This utilises ATNA and is compliant with international standards.
* Monitoring of transactions relating to performance, data synchronisation and system usage.  
* Error management: Provides the ability for an administrator to review and bulk re-run requests or re-run individual requests, alleviating the need for point-of-service systems to re-send data. 
* Alerting: User alerts can be configured to be sent when requests fail or a particular failure rate is exceeded. Users can be notified via email or SMS. 
* The use of mediators for message transformation and orchestration. The OpenHIM provides a framework to add and manage your own custom implementation-specific mediators.  
** Transformation: Transforms messages received in one format into another format e.g. MHD to XDS.b or custom format to HL7v3. 
* Orchestration: Ensures the correct workflow between the systems components.
* The OpenHIM offers a publicly accessible mediator library for the re-use of existing mediators. 
* The OpenHIM is configurable, providing the flexibility to support differing use cases.
* The OpenHIM supports interchangeability of components, allowing for easier swap-outs for new and improved technologies and helping to minimise vendor lock-in.
* The OpenHIM is scalable to handle large transaction loads. It supports same server and multi-server clusters.   
* The OpenHIM allows messages to be easily intercepted for secondary use which is beneficial to enable additional functions as the HIE grows. For example, a patient encounter message could be routed to the SHR as well as to an aggregation service for submission to a data warehouse.
* The OpenHIM is easy to implement and manage on an operational basis.

As the OpenHIM provides these centralised services it means that domain services don’t have to implement functionality to audit, log and authenticate messages, making it simpler, faster and more cost effective to develop, manage and maintain your system/s. 

## Where is the OpenHIM used?
The OpenHIM has been implemented in a number of different projects, ranging from innovative prototypes to national level health systems strengthening projects. Read about some of these in our Implementation Case Studies.  

## How does the OpenHIM do this?

The OpenHIM allows you to secure and view requests to your web service Application Programming Interfaces (API). It acts as a reverse proxy to upstream services and while doing so, enables visibility into your service-oriented architecture (SOA) by logging each request and by providing metrics about requests hitting the services. It also provides a central entry point into your SOA and allows you to secure access through mutual Transport Layer Security (TLS) or basic-auth. In addition, the OpenHIM acts as a central exchange, or service bus, which provides for the following:
* Acts as a reverse proxy for web service - One can easily configure the OpenHIM to proxy web services, to multiple upstream hosts based on a URL pattern. It also supports multicasting requests to multiple different routes.
* Secures access to web services - The OpenHIM provides a secure interface to upstream hosts with certificate management and self-signed certificate generation along with advanced access control mechanisms based on client and server certificates.
* Supports Audit Trail and Node Authentication (ATNA): - The OpenHIM provides a full ATNA audit repository implementation and advanced audit viewer.  
* Provides visibility into the Service Oriented Architecture (SOA) - The administration console allows viewing of requests as they travel through the system as well as the ability to view metrics such as transaction loads and error rates. It allows an administrator to review and bulk re-run requests or re-run individual requests. The OpenHIM can automatically re-run requests to one's services if client systems are not able to.
* Extends request processing via mediators - The OpenHIM allows one to build one’s own micro-services, called mediators, that plug into the OpenHIM to extend its functionality. These mediators can be used to transform or orchestrate requests or support more complex business logic. The mediators also report details of what processing has been done back to the OpenHIM using the mediator framework. 
* Scalable - The OpenHIM is scalable, supporting same server and multi-server clusters, using MongoDB as the underlying database. MongoDB is inherently massively scalable due to its clustering and sharding capabilities and can be horizontally scaled to deal with billions of transactions per day. Sharding increases write performance, while adding secondary nodes to a cluster increases read performance. 
* Minimal transaction overhead - The OpenHIM used the latest technologies such as Node.js and MongoDB to ensure that it doesn’t introduce any significant overhead to requests.


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
