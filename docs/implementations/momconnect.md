MomConnect
==============

MomConnect is a National Department of Health (NDOH) comprehensive digital health system programme in South Africa that addresses the following challenges:
* Various communication barriers that impacts the ability for healthcare providers to reach mothers during the early stages of their pregnancies.
* Limited knowledge among pregnant women or mothers of newborns to care for their own health as well as the health of their infant.
* The need for healthcare providers to ensure quality of care services.

MomConnect aims to overcome these challenges by providing a mobile health solution that enables the registration of pregnant women in South Africa and sends them targeted health informational messages during their pregnancy and over the course of their infant's first year of life. It is offered to all pregnant women and women with children under the age of 12 months who access public healthcare facilities in South Africa. The promotional messages sent to registered women contain important information that may assist them in improving their health as well as the health of their infants, including the importance of regular attendance at antenatal clinics throughout their pregnancy. 

The service also provides pregnant women with an interactive feedback mechanism which enables them to submit comments based on the quality of service they received at antenatal care facilities in terms of ratings and waiting periods. The women can also provide feedback during interactions with the Helpdesk in terms of compliments, complaints and questions. Using this information, MomConnect aims to strengthen demand and accountability of Maternal and Child Health services in order to improve access, coverage and quality of care for mothers and their children in the community.

## How the OpenHIM is used

The OpenHIM is used to provide security and visibility into the MomConnect Health Information Exchange (HIE). It also provides a number of orchestration and transformation service to enable pregnancies to be registered correctly in a pregnancy register. Alerting and reporting services are provided to ensure that the HIE is running smoothly on a day-to-day basis.

### The Software Architecture

The implemented architectural design for MomConnect is illustrated in figure 3 below. Mothers can opt-in to messaging through a free Unstructured Supplementary Service Data (USSD) line. The USSD data moves into District Health Information System (DHIS2) Tracker and other registries in a standards-compliant format through the OpenHIM. All reporting is provided through DHIS2.

Figure 3: MomConnect - Software Architectural Design
[![MomConnectSoftwareArchitecture](/_static/general/MomConnect-Fig4-SystemArchDesign.jpg)]

Incoming messages are validated, added to a queue and sent asynchronously to a mediator, which wraps all the Tracker Application programming interface (API) calls. As,  well as storing the person-level data DHIS2 also acts as the Master Facility List to validate facility information associated with the clinics. Tracker data is aggregated each night by specially developed aggregation scripts. Reports on the number of opt-ins, opt-outs, compliments and complaints, service ratings and patient demographics are accessed via DHIS2 HTML reports, pivot tables and GIS maps.

MomConnect uses a carefully designed system architecture which makes use of a load balancer technique so that it is possible to optimize system resource utilisation and maximise performance. The system architecture consists of two OpenHIM servers where each server handles the transaction load based on a configurable load weight within the load balancer where the sum of both weights equals 100%. Both OpenHIM servers are able to perform the following functions:
1.	Write data to DHIS
2.	Backup each transaction to MongoDB
3.	Extra backup for each transaction written to a MySQL database.
4.	Rerun failed transactions using the backup data in MongoDB or MySQL

Figure 4: MomConnect - System Architectural Design
[![MomConnectSystemArchitecture](/_static/general/MomConnect-Fig3-SoftwareArchDesign.PNG)]

This system architecture also allows for maximum system uptime during OpenHIM scheduled maintenance by allowing the software vendor to push all transaction load to one OpenHIM server while the other requires maintenance work. This strategy ensures system usability during maintenance operations as these operations will not have a negative impact on the day-to-day activities.

Each OpenHIM server has four mediators namely: message validator mediator, file queue mediator, orchestrator mediator and a tracker/populator mediator. Each mediator as shown in figure 5 below serves a core function during message handling for MomConnect and can be described as follows:
* Message Validator Mediator - Validates the message passed to the OpenHIM to ensure that it is well formed and is compliant with DHIS message formats.
* File Queue Mediator - Writes each request to the OpenHIM disk. Upon the successful commit to save the data to DHIS, the message is deleted from the disk. However, should a commit to DHIS fail, the message is retained on disk until it has been successfully committed to DHIS. This mediator has been incorporated into the architecture for two main reasons: 1) to ensure system usage even with communication issues present with DHIS as well as 2) to maximise system performance by not overloading the system with multiple message requests all needing to be committed at the same time. 
* Orchestrator Mediator: This mediator plays an important role during the message handling process as it needs to keep the OpenHIM informed regarding any failed attempts to commit data to DHIS. The OpenHIM needs to know when the file queue mediator is required to rerun message requests which is possible due to the feedback supplied by the orchestrator.
* Tracker/Populator Mediator - Used to monitor the completion status for the request as well as to commit the well-formed message to DHIS.

Figure 5: MomConnect - Mediators
[![MomConnectMediators](/_static/general/MomConnect-Fig5-Mediators.jpg)]
