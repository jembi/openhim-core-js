Design overview
===============

This section describes the architectural design of an Interoperability Layer for use within the [OpenHIE project](https://ohie.org/) (The OpenHIM is a reference implementation of an OpenHIE Interoperability Layer). It describes the key components that should make up an interoperability layer and how this relates to the other services that are used in OpenHIE.

Conceptually, the OpenHIM consists of the following three components:
1. Core (thin proxy)
2. Administration Console 
3. Mediators including orchestrators and adapter services


## Key Requirements

The full set of requirements that the Interoperability Layer community have identified can be found here: [Interoperability Layer - Use Cases and Requirements](https://wiki.ohie.org/display/SUB/Interoperability+Layer+-+Use+Cases+and+Requirements)

The following is a list of key requirements that are seen as necessary for any type of interoperability layer:

*   Provide a central point for authentication and authorization to the HIE services.
*   Log, audit and monitor communications for the components of the HIE.
*   Provide error management and transaction monitoring information to the administrators of the HIE.
*   Provide transaction orchestration services as well as adapter services to transform message between different message formats.

The defined set of requirements for Version 4.0.0 of the OpenHIM can be found here: OpenHIM V4.0.0 Functional and Technical Specification (https://docs.google.com/document/d/1w8F7bndVEcaM62BJ4T921JGFLnhUF4jAZP2sNnCQUzY/edit#)

## The architecture

Below, the architecture of the Interoperability Layer is shown in the context of the other expected services and registries. The Interoperability Layer components are show in **<span style="color: rgb(51,204,204);">blue</span>**, the domain services (registries) are shown in **<span style="color: rgb(153,51,0);">red</span>** and the clients are shown in <span style="color: rgb(153,204,0);">**green.**</span>

![](/_static/design/Central-HIM-componentv2.png)

### The core (thin proxy) component

The core provides the key functions and services required for an interoperability layer. These functions are useful in a service-oriented architecture (SOA) environment, which is essentially a collection of services that communicate with each other. 

This component can be thought of as the entry point into the HIE. It provides some common mundane services so that other domain services don't have to implement these. This component essentially acts as a web service proxy while performing some additional functions on the incoming requests. It makes use of several other services in order to perform the functions mentioned below: 

* Authorisation and Authentication - This service ensures that the client (human user or system) requesting or submitting information is known to the HIE and has the correct privileges or permissions to do so.
* Log Service - This service stores each message in its entirety along with metadata about the message, such as who sent it, time and date the message was received, and the response that the service returned, as well as error information if available.
* Audit service - This service audits each message received by storing an audit log entry. This log entry contains certain key information such as who sent the message, what information was requested and when the information was requested.
* Basic Routing - A routing mechanism that routes requests received to the correct upstream service. The router makes use of a publish and subscribe pattern so that messages can be routed to multiple interested parties. This allows for the secondary use of the messages received by the system. For example, an encounter message could be routed to the Shared Health Record (SHR) as well as an aggregation service where they could be aggregated and submitted to an aggregate data store such as a data warehouse.

The interoperability layer and system that it connects to will make use of the [IHE ATNA profile](http://wiki.ihe.net/index.php?title=Audit_Trail_and_Node_Authentication)'s node authentication section for authentication. For authorization the provider registry will maintain a list of provider authorities and the interoperability layer will check these during orchestration of each transaction.

Derek Ritz has put together a great slideshow to show how authorization and authentication will be handled within OpenHIE. Please see this resource here: [authentication and authorization slideshow](https://wiki.ohie.org/download/attachments/11370499/13-10-16%20authentication%20and%20authorization.pptx?version=1&modificationDate=1381995929235&api=v2).

### Administration Console

The console is an interactive web application which allows the system administrator to configure the OpenHIM core and carry out maintenance and monitoring of the transactions passing through the channels.  The main functions of the OpenHIM console are to:
* Create and manage users and adjust their group membership
* Configure clients, channels, and routes
* Monitor transactions 
* View an audit log of the system interactions
* Manage errors by allowing an administrator to re-run failed transactions individually or in bulk

### Mediators

Mediation refers to the processing of data so that it can be communicated from one interface to another. OpenHIM mediators are separate services that run independently from the OpenHIM core and perform additional mediation tasks for a particular use case. They are often implementation specific, designed and built to meet a specific need.  Each of these components are separate, independent services that perform a specific function following the micro services architecture ([click here for additional information about mico service architectures](http://yobriefca.se/blog/2013/04/29/micro-service-architecture/)).

There are three types of mediators:
* Pass-through mediator - Accepts a request and passes it on unchanged.
* Adaptor mediator - This service type adapts an incoming request to a form that the intended recipient of the request can understand: it accepts a request and transforms/adapts the request into another format before sending the request on to its final destination e.g. HL7 v2 to HL7 v3 or MHD to XDS.b. They are used to simplify communication with the domain services (for orchestrator use) and to adapt a standards-based interface to a custom domain service interface (or vice versa).
* Orchestration mediator - This service type enables a business process to be executed: this normally involves one or more additional services being invoked to process the required transaction. It accepts a request and uses that request to execute a business function that may need to call out to other service endpoints on other systems e.g. enriching a message with a client’s unique identifier retrieved from a client registry.

These services are invoked whenever there is a need to orchestrate or adapt a certain transaction. Both the orchestrator and adapter services are also expected to log and audit messages that they send out to the domain services. If they are not needed the core interoperability layer component will just call the domain service directly. Orchestrators may use other adapters to send messages to other services.  Designing these orchestrators and adapters as independent services allow for additional logic or business processes to be added as the need arises. This allows the solution architecture to adapt and grow as the environment changes.

Mediators can be built using any desired platform or any language fit for the requirement. The OpenHIM core defines the interfaces that the mediators are able to use to communicate and exchange metadata with the core, both at a transaction-level as well as general configuration for the mediator. Mediators can also use these interfaces to send their "availability" status to the Core for monitoring purposes.

