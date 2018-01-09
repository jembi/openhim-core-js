Creating your first channel
===========================

This tutorial assumes that you've set up the [required dependencies](../getting-started.html "Getting Started"), including setting up the OpenHIM, and that you are ready to create your first channel. In this tutorial we will look at setting up a channel on the HIM that will allow you to route data from a demo service. You will first need to create a **Client** that gets authenticated when requests are made. First, access the HIM Console on your browser, and login using the appropriate credentials. Next, go through to the **Clients** section (**Sidebar -> Clients**), create a new **Client** with the following details and save:

*   ClientID: **tut**
*   Client Name: **OpenHIM Tutorial Client**
*   Domain: **openhim.org**
*   Roles: **tut**
*   Password: **tut**

For this tutorial, we will be using **Basic auth** for authenticating the client. The OpenHIM supports both basic authentication and mutual TLS. With this in mind, ensure that your HIM Core instance is running with Basic auth enabled. To do so, and if not already done, create a copy of the [default config file](https://github.com/jembi/openhim-core-js/blob/master/config/default.json#L60-L63 "default.json") and ensure that **enableBasicAuthentication** is **true** (the default). You can also override any other config if required and startup core using:

`$ openhim-core --conf=myconfig.json`

Next we need to create a **Channel** which will route our request. Lets go through to the **Channels** section (**Sidebar -> Channels**) and create a new **Channel** with the following details and save:

*   Basic Info:
    *   Name: **Tutorial Channel**
    *   URL Pattern: **/encounters/.***
*   Access Control:
    *   Allowed roles and clients: **tut (NB! This is the Client's roles that we created previously)**
*   Routes -> Add new Route:
    *   Name: **Tutorial Route**
    *   Primary: **True**
    *   Type: **HTTP**
    *   Secured: **Not Secured**
    *   Host: **localhost**
    *   Port: **3444**

You can use the green save button to store the route to the channel. You may also need to change **localhost** to an appropriate value, depending on your setup and the locations of your various services. This configuration allows us to create a channel that routes data from a client to the mock health record service. The URL pattern field allows us to define a regular expression for matching incoming requests to this specific channel. In this case, we're telling the HIM that any requests that match the pattern **/encounters/{anything}**, belong to this tutorial channel. The HIM will then route those requests to **http://localhost:3444/encounters/{anything}**. Note that the health records service itself is unsecured, but that security is enabled for the HIM core itself. The HIM is therefore providing a security layer for our unsecured service. Now that our Client and Channel has been created, we're ready to send through a transaction! We will be doing this using a CURL command:

`$ curl -k -u tut:tut https://localhost:5000/encounters/1`

If you get an **Internal Server Error** then make sure that your service is running and that **Tutorial Channel** is able to route to it. Update your channel route to use your inet addr instead of localhost Example: Channel -> route -> Host: 192.168.1.10

If you have followed Tutorial 1 correctly then your transactions should have routed through the OpenHIM and reached the Health Record Service successfully. You should see a JSON object printed on your terminal with the Health Record result. You should also be able to see the transaction's log in the HIM console. Here you will see the **/encounters/1** request was successful and the response body contains the returned JSON object.