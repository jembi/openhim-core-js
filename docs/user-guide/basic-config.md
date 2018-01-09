Basic configuration
===================

This getting started guide will take you through two very important parts of the OpenHIM console which will allow you to create **Clients** and **Channels** to get messages routed through the system.

Before you get started with **Clients** and **Channels** you will need OpenHIM core and OpenHIM console setup. To do so, follow the installation guide [here](../getting-started.html).

To get a better understanding of what the openHIM core does and how it works, read up on the [OpenHIM core concepts](../about.html)

A **Client** is usually some system that you want to able to send request to the OpenHIM. Setting up a **client** allows the OpenHIM to authenticate requests. A **Channel** defines a path that a request will take through the OpenHIM. It describes one more **routes** for the request to be forwarded to, which **clients** are allowed to use this **channel**, which requests are to be direccted to this **channel** and many more options that allow you to controls what happens for a particular request.

To manage **clients** and **channels** you will need to log into the OpenHIM console and then you may follow the steps below.

**Note** - Only an Admin user has the permission to Add/Edit/Delete a **Client** or **Channel**

Adding Clients
--------------

Follow the below steps to successfully create/update a **Client**

* Navigate to the **Clients** menu option found in the left sidebar.
* On the **Clients** page you will be presented with a list of all the created **Clients**
* Click on the blue "**+ Client**" button to open a popup modal box where you will supply the **Client** details **OR** click on one of the existing **Clients** to open up the popup modal with the **Clients'** saved details.
* Supply all the required fields (marked with a *) and click the blue "**Save changes**" button when completed.

There are many fields that you may supply, here is an explanation of what each of them do:

* **Client ID** - This is a unique ID giving to a client to be used as a reference when adding **Channels** as well as for authorisation checking.
* **Client Name** - This is a descriptive name of the **Client**.
* **Domain** - A domain that is associated with this **Client** - **Note** The domain needs to match the CN of the certificate if a certificate is used otherwise the **Client** won't be authorised successfully.
* **Roles** - The **Client** roles field is a list of authorized user groups that are allowed to access this channel. You can either select a role from the suggested roles that appear when you start typing, or you can add a new role to the list by typing in the role and pressing "**Enter**"
* **Certificate** - The certificate field is used when the OpenHIM core is running using Mutual TLS Authentication and needs to authenticate requests coming from the **Client**. By default, OpenHIM core uses Mutual TLS Authentication
* **Basic Auth Password** - The password field is used when the OpenHIM core is running in basic auth mode and does not require a certificate, it does however require a password.

**Note** - Either a Certificate OR a Basic Auth Password is required depending on the configuration. If Basic Auth is enabled in the OpenHIM core configuration then only a password is required, if Mutual TLS Authentication is enabled then a **Client** Certificate is required.

**Note** - When a **Client** Certificate is added or updated, the OpenHIM console will inform the user that a server restart is required. This is for the new certificate to be applied correctly. The user can either decide to manually restart the server at a later time or to click the red "**Restart Server Now!**" button.

Adding Channels
---------------

Follow the below steps to successfully create/update a **Channel**

* Navigate to the **Channels** menu option found in the left sidebar.
* On the **Channels** page you will be presented with a list of all the created **Channels**
* Click on the blue "**+ Channel**" button to open a popup modal box where you will supply the **Channel** details **OR** click on one of the existing **Channels** to open up the popup modal with the **Channels'** saved details.
* Supply all the required fields and click the blue "**Save changes**" button when completed.

The two _most_ important fields to supply are the **URL Pattern** field and the **Allowed roles and clients** field. The **URL Pattern** field describes which incoming requests should be send down this **channel**. It does this by looking at the URL of the incoming request and testing if it matches the RegEx that you supply in this field. Note, only the first matched **channel** that is found recieves the request for processing. The **Allowed roles and clients** field identifies which **clients** are allowed to send requests to this **channel**. If a request matches a **channel** but the **client** system is not specified in this field or a **role** containing that the **client** belongs to is not specified in this field then the request will be denied access to the **channel**.

There are many fields that you may supply and these are spread over a number of tabs, here is an explanation of what each of them do:

* **Basic Info tab**
    * **Channel Name** - This is a descriptive name of the **Channel**.
    * **Channel Type** - Select a **Channel** type
        * **HTTP** - Default **Channel** type.
          * **Methods** - The allowed `http` methods for a channel
        * **TCP** - Supply a TCP Host and Port
        * **TLS** - Supply a TLS Host and Port
        * **Polling** - Supply a Polling schedule - Cron format: '*/10 * * * *' or Written format: '10 minutes' - The module 'Agenda' is used to accomplish the polling - You can find more documentation [here](https://github.com/rschmukler/agenda)
    * **Status** - Set whether this channel is enabled to receive requests or if its disbaled*.
* **Request Matching tab**:
    * **URL Pattern** - Supply a URL pattern to match an incoming transaction - **Note** this field excepts a RegEx value - More information on RegEx can be found [here](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions) or [here](http://www.regular-expressions.info/)
        * NB!. This field is not applicable for **Channel Type** of **TCP** or **TLS**
    * **Priority** - If a transaction matches the URL patterns of two or more channels, then the channel with higher priority will be picked. A value of 1 is the highest possible priority (first priority). Larger numbers therefore indicate that a channel should take lower priority.
    * **Authentication Type** - Set whether this channel is **Private** or **Public**
    * **Whitelisted IP addresses** - ???A list of IP addresses that will be given access without authentication required???
    * **Allowed roles and clients** - Only applicable when **Authentication Type** is set to **Private**. Supply the roles and **Clients** allowed to make requests to this channel
    * **Match Content Types** - Supply what content type to match too. (e.g text/json)
    * **Matching Options** - These options allows a **Channel** to be used if the request body matches certain conditions.
        * **No Matching** - No matching applicable
        * **RegEx Matching** - Supply a RegEx to match
        * **XML Matching** - Supply a X Path as well as a value to match
        * **JSON Matching** - Supply a JSON property as well as a value to match
* **Routes tab**:
    * **Mediator Route** - Select a mediator route if any, to populate the required route fields
    * **Name** - This is a descriptive name of the route
    * **Route Type** - Select whether this route is an HTTP/TCP or MLLP request
    * **Path** - Supply a path the route should follow. If none supplied then the **Channel** URL Pattern will be used.
    * **Path Transform** - Applies a said-like expression to the path string - Multiple endpoints can be reached using the same route.
    * **Host** - The host where this route should go to.
    * **Port** - The port where this route should go to.
    * **Basic Auth Username** - Supply a username if the route requires basic authentication.
    * **Basic Auth Password** - Supply a password if the route requires basic authentication.
    * **Is this the primary route?** - Set whether or not a route is primary - Setting a route to primary indicates that this is the first route to check and is the primary endpoint to reach.
    * **Status** - Set whether or not a route is enabled/disabled.
    * **+ Save** - All required fields need to be supplied before the blue "**+ Save**" button becomes active.
    * **Note** - At least one route needs to be added to the **Channel** and only one route is allowed to be set to primary
* **Data Control tab**:
    * **Store Request Body** - Select whether or not to store the request body.
        * **Note** - If a transaction is made through a POST/PUT/PATCH method and request body is NOT saved, then the transaction cannot be rerun.
    * **Store Response Body** - Select whether or not to store the response body.
    * **Auto Retry** - A feature that allows the OpenHIM to periodically resend failed transactions. Only transactions that have failed due to a connection type error, e.g. if a server is unavailable, or an internal OpenHIM error will be retried. I.e. if a target server responds with a status of 500, then that transaction won't be retried since the transaction was delivered by the OpenHIM.
        * **Automatically resend failed transactions** - Enable/disable auto retry for the channel.
        * **How often** - A minimum period to wait (in minutes) before retrying a transaction.
        * **Enabled max number of attempts** - Enable/disable a limit for the number of times a transaction should be retried.
        * **Time** - Value for maximum number of retries.
    * **URL Rewriting enabled** - URL rewriting allows the OpenHIM to look for URLs in a response and rewrite them so that they point to the correct location.
        * **From Host/Port** - Supply the host and port value you are looking to rewrite.
        * **To Host/Port** - Supply the host and port value that will replace the 'From Host/Port' matches.
        * **Path Transform** - Applies a said-like expression to the path string - Multiple endpoints can be reached using the same route.
    * **Add Auto Rewrite Rules** - Determines whether automatic rewrite rules are used. These rules enabled URLs to be automatically rewritten for any URLs that points to a host that the OpenHIM proxies (any host on a primary route). These can be overridden by user specified rules if need be.
* **User Access tab**:
    * **User groups allowed to view this channel's transactions** - Supply the groups allowed to view this **Channel's** transactions
    * **User groups allowed to view this channel's transactions request/response body** - Supply the groups allowed to view the request/response body of this **Channel's** transactions
    * **User groups allowed to rerun this channel's transactions** - Supply the groups allowed to rerun this **Channel's** transactions
* **Alerts tab**:
    * **Status** - Supply the status of a transaction when the alert should be sent. This can be supplied in a range format (e.g 2xx or 4xx)
    * **Failure Rate (%)** - Supply the failure rate of when to start sending the alerts (e.g 50 - once failure rate above 50% then alerts will be sent)
    * **Add Users** - Add individual users to receive alerts
        * **User** - Select a user from the drop down to receive a alert
        * **Method** - Select the method of how the alert should be delivered [Email | SMS]
        * **Max Alerts** - Select the frequency of how often to send a alert [no max | 1 per hour | 1 per day]
    * **Add Groups** - Add an entire group to receive alerts
        * **Add a new group** - Select a group from the drop down to be added to alerts
    * **+ Alert** - All required fields need to be supplied before the blue "**+ Save**" button becomes active.

If you find a field that is not described here, please let us know by [filing an issue on github](https://github.com/jembi/openhim-core-js/issues/new) with the 'documentation' label.
