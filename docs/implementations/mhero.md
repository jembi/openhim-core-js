mHero
=====

Mobile Health Worker Electronic Response and Outreach (mHero) harnesses the power of mobile technology to reach frontline health workers. It is a two-way, mobile phone-based communication system that uses basic text messaging, or SMS, to connect ministries of health and health workers. mHero was rapidly developed in August 2014 to support health-sector communication during the Ebola outbreak in Liberia and is being extended for use in Sierra Leone, Guinea and Mali.

Health officials can use mHero to:
* Communicate critical messages to health workers during a crisis or emergency response. 
* Target messages to health workers based on cadre, location, or skill set. 
* Collect critical information that powers resilient health systems, including stock levels, routine and one-time assessments, and validation of health worker and facility data.
* Provide care reminders and manage client referrals to strengthen clinical support. 

For more information please see the [mHero](http://www.mhero.org) website.

## How the OpenHIM is used

mHero is not a new technology. It’s a way to connect data from existing health information systems to allow for targeted, real-time communication. mHero brings together existing components of a country’s health information system using open international interoperability standards for health information exchange. The OpenHIM is deployed as the interoperability layer that connects the following systems:

* DHIS2 houses information on service delivery statistics and facilities
* iHRIS houses information on health workers, including their mobile phone numbers
* SMS messages are developed and tested in RapidPro
* DHIS2 and iHRIS are connected through the health worker registry, which connects to RapidPro through the OpenHIM

![mhero architecture](/_static/mhero/mhero-diagram.png)

Within the context of mHero, the OpenHIM performs a few vital functions.

* It triggers the synchronization between RapidPro and the OpenInfoMan.
* It provides visibility into the messages being exchanged. This allows the user to ensure that the data exchange is occurring correctly.
* It ensures that the communication between components occurs securely and it logs the transactions for historical and audit purposes.
* It provides authentication and authorisation mechanisms to control access to the OpenInfoMan documents

The OpenHIM provides polling channels to trigger the synchronization between RapidPro and the OpenInfoMan. These polling channels execute periodically and trigger an mHero mediator which in turn pulls data out of the OpenInfoMan and pushes it into RapidPro. To learn more about polling channels please see the OpenHIM docs here.

The OpenHIM provides a web console that enables the user to view these synchronization message. This enables any problems to be debugged effectively and provides confidence that the synchronization is working effectively.

The OpenHIM was designed to protect an HIE by providing mechanisms to secure transactions  between various components of the HIE. It can ensure that requests that access certain OpenInfoMan documents come from known and authorised sources.

Within mHero, the OpenInfoMan contains a number of documents which contain health worker and facility information. The OpenHIM prevents unauthorised access to these documents by implementing a role-based access control mechanism. This allows documents with sensitive information to be secured and documents with non-sensitive information to be as open and accessible as necessary.
