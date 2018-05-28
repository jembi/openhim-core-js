About the OpenHIM
====================

The Open Health Information Mediator (OpenHIM) is an interoperability layer: a software component that enables easier interoperability between disparate electronic information systems by providing a central point where the exchange of data is managed. An interoperability layer receives transactions from different information systems and coordinates the interactions between them. The OpenHIM provides a layer of abstraction between systems that allows for the transformation of incoming messages to a form that the other system components expect and can support the business logic by orchestrating the transaction flow.

The OpenHIM was initially developed by Jembi Health Systems  in collaboration with the Health Architecture Laboratory ( HeAL)  at the University of KwaZulu-Natal as part of the Rwanda Health Enterprise Architecture (RHEA) project, and formed the basis for Ryan Crichton’s Master's thesis  “The Open Health Information Mediator: an Architecture for Enabling Interoperability in Low to Middle Income Countries”.  The OpenHIM is the current reference technology for the interoperability layer of the OpenHIE (Open Health Information Exchange). It is supported through a number of implementation projects that drive its continuing development to meet real world needs.

Some examples of common workflows that the OpenHIM can support to facilitate the sharing of health information within a Health Information Exchange are:
* Save a patient's clinical encounter to a shared health record so that authorised healthcare providers are able to access key clinical data that can inform better care
* Retrieve relevant information about patient encounters and care plans for authorised healthcare providers
* Receive aggregate reporting information from a client system and send this to an aggregate datastore
* Manage health facilities
* Manage patient demographics and identity to allow for the tracking of a patient’s activity within and between healthcare  organisations and across the continuum of care

## Ok. But, what does the OpenHIM actually do?

The OpenHIM enables easier interoperability between systems by connecting all of the infrastructure services and client or point of service applications together. In the OpenHIE context, these systems are Health Information Systems (HISs) such as a client registry, provider registry, facility registry, shared health record, terminology service and a data warehouse.

![OpenHIEArchitecture](/_static/overview/OpenHIEArchitecture.png)

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
  * Transformation: Transforms messages received in one format into another format e.g. MHD to XDS.b or custom format to HL7v3.
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

## Components of the OpenHIM

The OpenHIM logically consists of three components:
* The OpenHIM Core provides the main functions and services
* The Administration Console provides an easy to use interface for system administrators to configure and manage the OpenHIM, giving a window into the workings of the HIE.
* Mediators are additional services used to extend the functionality of the OpenHIM by transforming and orchestrating transactions.

![OpenHIM Components](/_static/overview/OpenHIMComponents.png)

### The OpenHIM Core
The OpenHIM Core provides the key functions and services required for an interoperability layer that are useful in a Service Oriented Architecture (SOA) environment. A service-oriented architecture is essentially a collection of services that communicate with each other. The communication can involve either simple data passing or it could involve two or more services coordinating an activity. The OpenHIM is used to connect these services to each other: it provides an interface that point of service applications (clients) are able to contact in order to reach the services provided in the SOA. You can think of this interface as a reverse proxy for your applications but with some special features.

The functions of the OpenHIM Core are identified as follows:
* Basic Routing - A routing mechanism that routes requests received to the correct upstream service.
* Log Service and Audit Repository- This service stores each message in its entirety along with metadata about the message, such as the time and the date the message was received, who sent the message, what information was requested  and the response that the service returned, as well as error information when available.
* Authorization and Authentication - The OpenHIM Core ensures that the client system requesting or submitting information is known and has the correct privileges to do so.
* Error Monitoring - Displaying and monitoring errors that occur between the services, including email and SMS alerting.
* Transaction ReRunning - Replays transactions by resending them to its target service(s). Transactions can also be rerun automatically if a service is unavailable.
* Transaction Metrics -  Calculations of statistics such as the number of transactions in a specific period
The OpenHIM-core also provides a framework to add and manage your own implementation specific mediators in the system.

### OpenHIM Administration Console
The admin console is a web-based user interface that provides visual tools to assist administrators interacting with the OpenHIM Core for maintenance and monitoring. Administrators use the console to set up users and roles for the client systems that will be sending and receiving the information, and to configure the channels and routes that the information will pass through. Administrators can also monitor the OpenHIM transactions via the console and re-run failed transactions if necessary.
The main functions of the OpenHIM console are:
* Creation and management of client users and groups
* Configuration  of  clients, channels and routes
* Transaction monitoring
* Auditing of system interactions
* Error management

### Mediators
OpenHIM mediators are separate micro services that run independently from the OpenHIM Core and perform additional mediation tasks for a particular use case. Mediators can be built using any platform or language fit for the requirement. The Core defines interfaces that mediators use to communicate and exchange metadata with the Core, both at a transaction-level as well as general configuration for the mediator. Mediators can also use these interfaces to send their "availability" status to Core for monitoring purposes.
There are three types of mediators:
* Pass-through mediator - Accepts a request and passes it on unchanged.
* Adaptor mediator - Accepts a request and transforms/adapts the request into another format before sending the request on to its final destination e.g. transform HL7 v2 to HL7 v3 or transform MHD to XDS.b.  Adapters are used to simplify communication with the domain services and also to adapt a standards-based interface to a custom domain service interface.
* Orchestration mediator - Accepts a request and uses that request to execute a business function that may need to call out to other service endpoints on other systems e.g. enriching a message with a client’s unique identifier retrieved from a client registry.
These services are invoked whenever there is a need to orchestrate or adapt a certain transaction. If they are not needed the OpenHIM core component will call the domain service directly.  Orchestrators may use other adapters to send messages to other services.
As the architecture is designed to evolve as the environment changes, designing these orchestrators and adapters as independent services allows for additional logic or business processes to be added as the need arises.  Mediators are often implementation specific so they will change to meet the specific needs and business processes of the system.  A mediator library is available so that existing mediators can be re-used or adapted as needed. Both the orchestrator and adapter services are also expected to log and audit messages that they send out to the domain services. These services are implemented as mediators within the OpenHIM.

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
