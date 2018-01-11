# How to setup and configure the OpenHIM

## OpenHIM Basic Configuration

Two very important parts of the OpenHIM console are the `Clients` and `Channels` where both are essential for enabling the routing of messages through the system. Before you get started with clients and channels, you will need the OpenHIM core and OpenHIM console installed and configured. Please see section 4.1 which discusses this process.

### What is a Client

A client is usually some system that you want to able to send request to the OpenHIM. Setting up a client allows the OpenHIM to authenticate requests.

### What is a Channel

A channel defines a path that a request will take through the OpenHIM. It describes one or more routes for the request to be forwarded to, which clients are allowed to use the channel, which requests are to be directed to this channel and many more options that allows you to control what happens for a particular request.
The management of clients and channels are discussed later in the document. Only an OpenHIM administrative user has the permission to `Add`, `Edit` and `Delete` a Client or Channel

---

## OpenHIM Clients

Using an OpenHIM administrative account, you will be able to add, edit and remove clients by following a few easy steps.

The following is an explanation of the fields that are used in the `Add Client` form:

- **Client ID** - This is a unique ID which a client will use as a reference when adding channels as well as for authorisation checking.
- **Client Name** - This is a descriptive name of the client.
- **Domain** - A domain that is associated with a client.
    > **Note**: The domain needs to match the CN of the certificate if a certificate is used otherwise the client won’t be authorised successfully.
- **Roles** - The client roles field is a list of authorized user groups that are allowed to access this channel. You can either select a role from the suggested roles that appear when you start typing, or you can add a new role to the list by typing in the role and pressing Enter.
    > **Note**: suggested roles will only appear as you type, if they already exist in the OpenHIM.
- **Certificate** - The certificate field is used when the OpenHIM core is running using mutual TLS authentication and needs to authenticate requests coming from the client. By default, the OpenHIM core uses mutual TLS authentication.
- **Basic Auth Password** - The password field is used when the OpenHIM core is running in basic auth mode and does not require a certificate, it does however require a password.

### How to add clients

> **Note**: All fields marked with a * or ** indicates a mandatory field.

    * - Indicates a required field which means that it cannot be left blank.
    ** - Indicates that one of the fields are required.

1. Log in to your OpenHIM console.
1. Click on `Clients` found in the left navigation menu.
1. Click on the button labelled `+ Client` to open a popup window where you will be able to supply the client details.
1. Capture the client details.
1. Assign an existing role or enter a name for a new role which will be created and linked to this client.
1. You may choose to make use of a basic auth password or client certificate, depending on your OpenHIM configuration. If basic auth is enabled in the OpenHIM core configuration, then only a password is required and if mutual TLS authentication is enabled, then only a client certificate is required:
    - *Certificate*: You may choose one of the available client certificates from the `Client Certificate` drop down.
      > **Note**: This will only be possible if you have already configured one or more client certificates in the OpenHIM Console.
    - *Basic Auth Password*: Enter a `Basic Auth Password` and confirm it by retyping it in the confirm password textbox.
1. Click on the `Save Changes` button to save your new client.

> **Note**: When a client certificate is added or updated in the certificates component of the OpenHIM, the OpenHIM console will inform the OpenHIM administrator that a server restart is required. This is for the new certificate to be applied correctly. The user can either decide to manually restart the server at a later time or to click the red `Restart Server Now!` button.

### How to remove clients

1. Log in to your OpenHIM console.
1. Click on `Clients` found in the left navigation menu.
1. Locate the client to be removed and click on the red `X` button on the far right.
1. You will be prompted to confirm your action to delete the chosen client.
1. Click on the `Delete` button.

> **Note**: This action automatically deletes the role if the role was created primarily for the client that is busy being deleted with no other clients sharing the same role.

### How to edit clients

1. Log in to your OpenHIM console.
1. Click on `Clients` found in the left navigation menu.
1. Locate the client to be edited.
1. Click on the amber button that looks like a pencil on the far right.
1. Update the client information as required.
1. Click on the `Save Changes` button to update the client.

### Client Roles

The purpose of these roles is to act as a list of authorised user groups which are allowed to access and use a given channel. These roles are generally assigned during the creation process when adding a new client.

The following rules apply to roles:

- A role may be assigned to one or more clients.
- When a role is deleted, all clients referencing this role will be automatically updated by unlinking the role.
- A client may be associated with one or more roles.

#### How to use roles

`Roles` allow the OpenHIM administrator to quickly and effortlessly enable or disable channels to which a role has access. The purpose and use of channels will be covered a little later in this document.

#### How to add roles

1. Log in to your OpenHIM console.
1. Click on `Clients` found in the left navigation menu.
1. Click on the green `+ Role` button.
1. Notice the creation of the new line item.
1. Specify a name for the role in the empty white box.
1. Enable any of the available channels that the role needs to use.
1. Click on the yellow button that looks like a floppy disk to save the role.

> **Note**: By default all channels are disabled at the point of creation.

#### How to remove roles

1. Log in to your OpenHIM console.
1. Click on `Clients` found in the left navigation menu.
1. Locate the role to be deleted under the Roles section.
1. Click on the red `X` button.
1. You will be prompted to confirm your action to delete the chosen client.
1. Click on the `Delete` button.

> **Note**: All clients referencing this role will be automatically updated by unlinking the role.

#### How to edit roles

1. Log in to your OpenHIM console.
1. Click on `Clients` found in the left navigation menu.
1. Under the Roles section, Enable or disable channels to be used by the role by clicking on either the green `✓` or the red `X`.
    > **Note**: You will not see the green `✓` or the red `X` if you don't have any channels configured.
1. The changes are automatically saved.

> **Note**: A `✓` means enabled whereas a `X` means disabled.

---

## OpenHIM Channels

Using an OpenHIM administrative account, you will be able to add, edit and remove channels by following a few easy steps.

Two of the most important fields are the URL pattern field and the allowed roles and clients field. The URL pattern field describes which incoming requests should be sent down a channel. It does this by looking at the URL of the incoming request and tests to verify that it matches the Regular Expression (RegEx) that you supplied in this field.

> **Note**: Only the first matched channel that is found will receive the request for processing.

The allowed roles and clients field identifies which clients are allowed to send requests to a channel. If a request matches a channel but the client system is not specified in the field, or where a role that the client belongs to is not specified in this field, then the request will be denied access to the channel.

The following is an explanation of the fields that are used in the `Add Channels` form.

<u>**Basic Info Tab**</u>

1. Channel Name - This is a descriptive name of the Channel.
1. Channel Type - The type of channel to be configured:
    - ***Hypertext Transfer Protocol (HTTP)*** - Default channel type.
    - ***Transmission Control Protocol (TCP)*** - Supply a TCP host and port number.
    - ***TLS*** - Supply a TLS host and port number.
    - ***Polling*** - Supply a Polling schedule in a cron format: `*/10 * * * *` or written format: `10 minutes`.

        > **Note**: The module called `Agenda` is used to accomplish the polling. Please visit the [Agenda documentation](https://github.com/agenda/agenda) for more information.
1. ***Status*** - Enable or disable the channel.

<u>**Request Matching Tab**</u>

1. URL Pattern - Supply a URL pattern to match an incoming transaction.
    > **Note**: this field accepts a RegEx value. This field is not applicable for Channel Type of TCP or TLS.
1. Priority - If a transaction matches the URL patterns of two or more channels, then the channel with higher priority will be picked. A value of 1 is the highest possible priority (first priority). Larger numbers therefore indicate that a channel should take lower priority.
1. Authentication Type - Set whether this channel is private or public.
1. Whitelisted IP Addresses - A list of IP addresses that will be given access without authentication required.
1. Allowed Roles and Clients - Only applicable when Authentication Type is set to private. Supply the Roles and Clients allowed to make requests to this channel.
1. Match Content Types - Supply what content type to match too. (e.g text/json).
1. Matching Options - These options allow a Channel to be used if the request body matches certain conditions.
    - No Matching - No matching applicable.
    - RegEx Matching - Supply a RegEx to match.
    - XML Matching - Supply an X Path as well as a value to match.
    - JSON Matching - Supply a JSON property as well as a value to match.

<u>**Routes Tab**</u>

1. **Mediator Route** - Select a mediator route if any, to populate the required route fields.
1. **Name** - This is a descriptive name of the route.
1. **Route Type** - Select whether this route is an HTTP/TCP or MLLP request.
1. **Path** - Supply a path the route should follow. If none supplied, then the Channel URL pattern will be used.
1. **Path Transform** - Applies a said-like expression to the path string - multiple endpoints can be reached using the same route.
1. **Host** - The host where this route should go to.
1. **Port** - The port where this route should go to.
1. **Basic Auth Username** - Supply a username if the route requires basic authentication.
1. **Basic Auth Password** - Supply a password if the route requires basic authentication.
1. **Is this the primary route?** - Set whether the route is primary - setting a route to primary indicates that this is the first route to check and is the primary endpoint to reach.
1. **Status** - Set whether the route is enabled/disabled.
1. '**+ Save**' - All required fields need to be supplied before the blue `+ Save` button becomes active.

    > **Note**: At least one route needs to be added to the Channel and only one route is allowed to be set to primary.

<u>**Data Control Tab**</u>

1. **Store Request Body** - Select whether to store the request body.

    > **Note**: If a transaction is made through a POST/PUT/PATCH method and request body is NOT saved, then the transaction cannot be rerun.
1. **Store Response Body** - Select whether to store the response body.
1. **Auto Retry** - A feature that allows the OpenHIM to periodically resend failed transactions. Only transactions that have failed due to a connection type error, e.g. if a server is unavailable, or an internal OpenHIM error will be retried. I.e. if a target server responds with a status of 500, then that transaction won’t be retried since the transaction was delivered by the OpenHIM.

    - *Automatically resend failed transactions* - Enable/disable auto retry for the channel.
    - *How often* - A minimum period to wait (in minutes) before retrying a transaction.
    - *Enabled max number of attempts* - Enable/disable a limit for the number of times a transaction should be retried.
    - *Time* - Value for maximum number of retries.
1. **URL Rewriting Enabled** - URL rewriting allows the OpenHIM to look for URLs in a response and rewrite them so that they point to the correct location.
     - *From Host/Port* - Supply the host and port value you are looking to rewrite.
     - *To Host/Por*t - Supply the host and port value that will replace the ‘From Host/Port’ matches.
     - *Path Transform* - Applies a said-like expression to the path string - multiple endpoints can be reached using the same route.
1. **Add Auto Rewrite Rules** - Determines whether automatic rewrite rules are used. These rules enabled URLs to be automatically rewritten for any URLs that points to a host that the OpenHIM proxies (any host on a primary route). These can be overridden by user specified rules if need be.

<u>**User Access Tab**</u>

1. **User groups allowed to view this channel’s transactions** - Supply the groups allowed to view this Channel’s transactions.
1. **User groups allowed to view this channel’s transactions request/response body** - Supply the groups allowed to view the request/response body of this Channel’s transactions.
1. **User groups allowed to rerun this channel’s transactions** - Supply the groups allowed to rerun this Channel’s transactions.

<u>**Alerts Tab**</u>

1. **Status** - Supply the status of a transaction when the alert should be sent. This can be supplied in a range format (e.g 2xx or 4xx).
1. **Failure Rate (%)** - Supply the failure rate of when to start sending the alerts (e.g 50 - once failure rate above 50% then alerts will be sent).
1. **Add Users** - Add individual users to receive alerts.
    - *User* - Select a user from the drop down to receive an alert.
    - *Method* - Select the method of how the alert should be delivered [Email | SMS].
    - *Max Alerts* - Select the frequency of how often to send an alert [no max | 1 per hour | 1 per day].
1. **Add Groups** - Add an entire group to receive alerts.
1. **Add a new group** - Select a group from the drop down to be added to alerts.
1. '**+ Alert**' - All required fields need to be supplied before the blue `+ Save` button becomes active.

### How to add a channel

> **Note**: All fields marked with a * or ** indicates a mandatory field.

    * - Indicates a required field which means that it cannot be left blank.
    ** - Indicates that one of the fields are required, no both.

1. Log in to your OpenHIM console.
1. Click on `Channels` found in the left navigation menu.
1. Click on the green `+ Channel` button.
1. Supply all the required fields and click the blue `Save changes` button when completed. See the above section which may assist with this process.

### How to remove a channel

1. Log in to your OpenHIM console.
1. Click on `Channels` found in the left navigation menu.
1. Locate the channel to be deleted.
1. Click on the red `X` button.
1. You will be prompted to confirm your action to delete the chosen channel.

### How to edit a channel

1. Log in to your OpenHIM console.
1. Click on `Channels` found in the left navigation menu.
1. Locate the channel to be edited.
1. Click on the amber button that looks like a pencil on the far right.
1. Update the channel information as required.
1. Click on the `Save Changes` button to update the channel.

### How to copy a channel’s config

1. Log in to your OpenHIM console.
1. Click on `Channels` found in the left navigation menu.
1. Locate the channel to be copied.
1. Click on the blue button that looks like an A4 paper icon on the far right.
1. Give your channel a unique name.
1. Click on the `Save Changes` button to create the new channel using the same config as the channel being copied.

---

## OpenHIM Visualizers

The visualizer displays a live view of how transactions are being routed through the OpenHIM. Multiple visualizers can be created and these are shared among OpenHIM admin users.

The following is an explanation of the fields that are used in the visualizations Management form:

- **Visualizer Name** - A unique name to identify the visualizer.
- **Components** - The components to be added to the visualizer.
  - Event Type - The nature of the event being triggered:
    - Primary Route - These routes are created during the creation of a channel.
    - Secondary Route - These routes are created during the creation of a channel and are not set as the primary route.
    - Orchestration - A mediator that processes a request and makes more subsequent request to perform a specific action.
    - Channel - Channels that are currently available in the OpenHIM console. See [OpenHim Channels](#openhim-channels) for more information regarding channels.
  - Event Name - The name of the event. These names are available as a dropdown for `Primary Route`, `Secondary Route` and Channel.
  - Display - An easily identifiable name to be displayed in the visualizers list of components being monitored.

    > **Note**: You may add one or more components by completing the fields above and clicking on the green `+` button. The red `X` button allows you to delete a component.
- **Channels** - A dropdown list of channels where you can select a channel to be monitored. You may select one or more channels by clicking on the Select Channel dropdown and choose a channel name. The red `X` button allows you to delete a channel.
- **Mediators** - The mediators to be added to the visualizer. Select a mediator from the dropdown list of mediator names. See [OpenHIM Mediators](#openhim-mediators) for more information regarding mediators.
- **Advanced Settings** - Allows you to customize your OpenHIM visualizer:
    - *Visualizer Color Management* - Choose your desired color styles for events monitoring.
    - *Visualizer Size Management* - Choose your desired size for the visualizer.
    - *Visualizer Time Management* - Choose when and for how long to display an event.

### How to add a visualizer

> **Note**: All fields marked with a * indicates a mandatory field.

1. Log in to your OpenHIM console.
1. Click on `Visualizers` found in the left navigation menu.
1. Click on the green `+ Visualizer` button.
1. Supply all the required fields and click the blue `Create Visualizer` button when completed. See the above section which may assist with this process.

### How to remove a visualizer

1. Log in to your OpenHIM console.
1. Click on `Visualizers` found in the left navigation menu.
1. Locate the visualizer to be deleted.
1. Click on the red `X` button.
1. You will be prompted to confirm your action to delete the chosen visualizer.

### How to edit a visualizer

1. Log in to your OpenHIM console.
1. Click on `Visualizers` found in the left navigation menu.
1. Locate the visualizer to be edited.
1. Click on the amber button that looks like a pencil.
1. Update the visualizer information as required.
1. Click on the `Save Changes` button to update the visualizer.

### How to copy a visualizer's config

1. Log in to your OpenHIM console.
1. Click on `Visualizers` found in the left navigation menu.
1. Locate the visualizer to be copied.
1. Click on the blue button that looks like an A4 paper icon on the left.
1. Give your visualizer a unique name.
1. Click on the `Create Visualizer` button to create the new visualizer using the same config as the visualizer being copied.

---

## OpenHIM Contact List

The OpenHIM is used for transaction alerting (found in each channel's configuration) and user reports (found in each user's configuration).

The following is an explanation of the fields that are used in the `Add Contact` list form:

- **List Name** - A uniquely identifiable display name for the list.
- **Users** - A dropdown of available users for selection to receive alerts.
    > **Note**: You may add one or more users to the contact list by clicking on the green `+ User` button. The red `X` button allows you to delete a user alert.
- **Method** - Delivery method for alerts.
- **Max Alerts** - Select a limit for alerts.

### How to add a contact list

> **Note**: All fields marked with a * indicates a mandatory field. Before you can select a user to receive alerts, you must first create all necessary users. See [OpenHIM Users](#openhim-users) for more information regarding users.

1. Log in to your OpenHIM console.
1. Click on `Contact List` found in the left navigation menu.
1. Click on the green `+ Contact List` button.
1. Supply all the required fields and click the blue `Save changes` button when completed. See the above section which may assist with this process.

### How to remove a contact list

1. Log in to your OpenHIM console.
1. Click on `Contact List` found in the left navigation menu.
1. Locate the contact list to be deleted.
1. Click on the red `X` button.
1. You will be prompted to confirm your action to delete the chosen Contact list.

### How to edit a contact list

1. Log in to your OpenHIM console.
1. Click on `Contact List` found in the left navigation menu.
1. Locate the contact list to be edited.
1. Click on the amber button that looks like a pencil.
1. Update the visualizer information as required.
1. Click on the `Save Changes` button to update the Contact list.

---

## OpenHIM Mediators

`Mediators` can be built using any platform that is desired (some good options are pure Java using our mediator engine, Node.js, Apache Camel, Mule ESB, or any language or platform that is a good fit for your needs). The only restriction is that the mediator MUST communicate with the OpenHIM core in a particular way. Mediators must register themselves with the OpenHIM core, accept request from the OpenHIM core and return a specialised response to the OpenHIM core in order to explain what that mediator did.

### How to add a mediator

Mediators are add-on services that run separately from the OpenHIM. They register themselves with the OpenHIM and once that is done, they will be displayed in the OpenHIM where their configuration details may be modified. Also, if a mediator is registered it will allow you to easily add routes that point to it in the channel configuration.

Mediators may be developed in any language and only talk to the OpenHIM via its RESTful API. Therefore, the installation instructions will differ for each mediator. Please refer to the documentation of that mediator for details on how to install it. However, there are best practices that apply to all mediators.

The following are best practices in regard to the setup of mediators:

1. Mediators do not have to be installed on the same server as the OpenHIM.
1. Ensure that the mediator is able to reach the OpenHIM core servers’ RESTful API endpoint.
1. Ensure that the OpenHIM is able to reach the mediator’s endpoint for receiving requests.
1. Ensure that you configure the mediator with correct credentials so that it may access the OpenHIMs RESTful API as an admin user.
1. Ensure that the mediator trusts the OpenHIMs core certificate (if it is self signed) as API communication must take place over https.

---

## OpenHIM Users

As an OpenHIM administrator, you may create other users. These too may belong to the admin group or may belong to other groups. Non-admin users cannot create clients and channels, however, they may view transactions for certain channels that they are given access to.

The following is an explanation of the fields that are used in the `Add a Channel` form:

- **Email** - Email address for the user.
- **First Name** - User first name.
- **Surname** - User surname/family name.
- **Phone Number** - Mobile contact number in the MSISDN format (eg. 27825555555) should you want to receive sms alerts.
- **Permissions Group** - The group name to which the user will be assigned. You may use an existing group or create a new group.

    > **Note**: While typing in the textbox, the OpenHIM will validate each keystroke to lookup any matching group names.
- **Password** - The user's password.

    > **Note**: Confirmation for a user account will need activation via email. A user's account will remain disabled/locked until he/she has confirmed.
- **Reports** - Choose which reports the user needs to receive via email. These reports include the following transaction statuses:
  - Completed
  - Completed with errors
  - Failed
  - Processing
  - Successful
- **List Settings and General Settings** - You may pre-define how you want the user to view transactions.

### How are users different from clients

Clients are different from users in that they represent systems that can route transactions through the OpenHIM. Users are people accessing and configuring the OpenHIM whereas clients are the systems that are allowed to send requests to the OpenHIM.

### User Groups

`Groups` are created automatically by just adding a new group name in the user form. You do not need to add a group explicitly. When you go on to create the channel, you just need to make sure the group name matches the one you specified when you created the `User`.

There are two kinds of groups:

1. Admin - This is a special group that grants users all permissions.
    > Note: The Admin group is created automatically.

1. The rest are defined by the system administrator.

> **Note**: When creating a channel, an administrator can set the level of user access by specifying the user groups which may have the necessary rights to view a channel, view a channels transactions, view the transactions request and response body, and rerun failed transactions.

#### Group Permissions

Users can be assigned custom permissions on a channel. This is done by adding the group to which they belong to that particular permission in the channel's configuration. By default, all custom user groups do not have permissions on any channel and will need to be set. Please see [OpenHIM Channels](#openhim-channels) for more information regarding channels.

User permissions comprise the following:

1. Ability to view channel transactions.
1. Ability to view channel transaction bodies.
    > **Note**: bodies may contain private patient data
1. Ability to re-run transactions.
    > **Note**: enabling this permission needs to be done with care because it may cause downstream duplicates and data corruption if the user hasn’t received sufficient training around this process.

### How to add users

> **Note**: All fields marked with a * indicates a mandatory field.

1. Log in to your OpenHIM console.
1. Click on `Users` found in the left navigation menu.
1. Click on the green `+ User` button.
1. Supply all the required fields and click the blue `Save changes` button when completed. See the above section which may assist with this process.

### How to remove users

1. Log in to your OpenHIM console.
1. Click on `Users` found in the left navigation menu.
1. Locate the user to be deleted.
1. Click on the red `X` button.
1. You will be prompted to confirm your action to delete the chosen user.

### How to edit users

1. Log in to your OpenHIM console.
1. Click on `Users` found in the left navigation menu.
1. Locate the user to be edited.
1. Click on the amber button that looks like a pencil.
1. Update the user information as required.
1. Click on the `Save Changes` button to update the user.

---

## OpenHIM Certificates

The OpenHIM has a built in capability to manage TLS certificates and keys through its keystore. You can upload a certificate and key that you have bought from a certificate authority such as [Thwate](https://www.thawte.com/) or you can generate your own self signed certificate to use in your private OpenHIM implementation. While both mechanisms are secure, it is suggested that you purchase a certificate from a trusted certificate authority to save you some unwanted difficulty with self signed certificates.

The OpenHIM also allows you to trust particular certificates. This allows you to specify exactly which client or external hosts you trust and it ties in with the OpenHIMs authentication mechanism for clients.

### How to add certificates

#### Server Certificate & Key

To upload an OpenHIM server certificate, simply drag and drop both the certificate and key into the correct boxes on the certificates page. Once done, you will be asked to restart the OpenHIM for this to take effect. The OpenHIM will also warn you if the key and certificate pair that you have uploaded do not match.

> **Note**: Do not restart the server if the certificate and key don’t match as this will prevent the server from being able to startup correctly and force you to fix this manually in the database. If your key requires a passphrase, be sure to submit that in the field provided as well.

#### Generating a Server Certificate

To generate a self signed certificate, click on the `+ Create Server Certificate` button in the top right. This will guide you through the process of creating a certificate and key. It will also automatically add this to the server once you are done. Make sure you download the certificate and key when asked to do so as the key is not stored on the server for security reasons.

#### Client Certificates

If you have some client certificates or host certificates that you want the OpenHIM to trust, you can add them by simply dropping them in the bottom box to have them uploaded. These certificates may be attached to clients when you edit a particular client from the clients page and enable clients to be authenticated when using mutual TLS. They may also be used on a route when editing a channel to trust a particular hosts certificate.

You may also add a client certificate by clicking on the `+ Create Client Certificate` button.

### How to remove certificates

1. Log in to your OpenHIM console.
1. Click on `Certificates` found in the left navigation menu.
1. Locate the certificate to be deleted.
1. Click on the red `X` button.
1. You will be prompted to confirm your action to delete the chosen certificate.

---

## Import/Export

Import and export the OpenHIM's configuration as desired. The configuration will be written out to or read in from a JSON file.

### How to import data

1. Log in to your OpenHIM console.
1. Click on `Export/Import` found in the left navigation menu.
1. Drag and drop your export file into the designated area, or click in the Import Data box to launch a browse dialog to search for and select a file.

### How to export data

> **Note**: The server's TLS private key will be exported and should be protected!

1. Log in to your OpenHIM console.
1. Click on `Export/Import` found in the left navigation menu.
1. Choose the values per category that you wish to export. By default, all values per category are selected. The categories are:
    - Channels
    - Clients
    - Contact Groups
    - Keystore
    - Mediators
    - Users
1. Click on the green `Generate Export Script` button
