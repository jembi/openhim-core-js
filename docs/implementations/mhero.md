mHero
=====

Mobile Health Worker Electronic Response and Outreach (mHero) is one way to harness the well-known power of mobile technology to reach frontline health workers. It combines data from multiple sources, such as a facility registry and a health worker registry, to enable targeted messaging directly to Health Workers. The messaging workflows that it enables provides an unprecedented link directly to those health workers that are in need of support.

For more information please see the [mHero](http://www.mhero.org/mHero/) website.

## How the OpenHIM is used

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
