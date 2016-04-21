Creating a passthrough mediator
===============================

This tutorial assumes that you have successfully completed Tutorial 1 which yielded a valid Health Record in the response body.

In the previous tutorial we created a basic channel for routing requests from the mock health record service. This is what we refer to as a **pass-through channel** - a channel that simply routes data "as is" from and to services. But we often want to do more than just pass through data unmodified. We may want to alter a request's format or enrich the request with extra information. This is where mediators come into play. A mediator is a light-weight HIM **micro-service** that performs operations on requests.

In the previous tutorial our channel returned a basic JSON health record for a patient. But wouldn't it be more useful for this tutorial if you could look at the data in an easy to read format on your web browser rather than using CURL? Or if the patient's name was included, rather than just an identifier? With a mediator we can do just that, and in this and the following tutorials we will look into creating a mediator that will convert our health record data to HTML (Note: you could convert to any data format that you choose, however, for the purposes of this tutorial we are using HTML as an example), so that we can view it easily in a web browser, and also enrich the message with patient and healthcare provider demographic information. Before we can get started though, we need to scaffold a basic mediator that we can use for these purposes, and this is what we'll be looking at in this tutorial.

If you want more detailed information on mediators and their related concepts, you can read up on them over [here](https://github.com/jembi/openhim-core-js/wiki/Creating-an-OpenHIM-mediator "Creating a Mediator"). You can create your mediator from scratch if you like by following these [guidelines](https://github.com/jembi/openhim-core-js/wiki/Creating-an-OpenHIM-mediator "Creating a Mediator"), or you can use our Yeoman Mediator Generator to scaffold your mediator in a few easy steps. We will be taking the Yeoman approach.

Install Yeoman Globally:

`$ npm install -g yo`

make sure yeoman is installed correctly by checking the version. execute the following command.

`$ yo -v`

Currently we have support for two differnt generators. One for scafolding a node.js mediator and another for scafolding a Java mediator. You may pick which ever language you are most comfortable with.

## NodeJS Mediator 

The below steps will guide you on how to create a new NodeJS Mediator through Yeoman. First, lets create a directory where our Mediator will be created:

`$ mkdir tutorialmediator && cd tutorialmediator`

To create a scaffolded Mediator through Yeoman you will need to download the npm **generator-mediator-js** module. execute the following command:

`$ npm install -g generator-mediator-js`

Now lets create our scaffold Mediator. There are two ways to execute the yo command. Either way is fine. Bring up the Yeoman menu with all generators listed:

`$ yo`

Or start the process for creating a Mediator:

`$ yo mediator-js`

Fill out the questions that are asked by Yeoman. These are used to create your configuration.

*   What is your Mediator's name?: **Tutorial Mediator**
*   What does your Mediator do?: **This is the mediator being used in the tutorial**
*   Under what port number should the mediator run?: **4000**
*   What is your primary route path? [keep this blank]

You have successfully created your scaffolded Mediator! NB! the mediator isn't ready to be launched yet, we still need to make a few changes. **NB! Remember to install your dependencies**

`$ npm install`

Lets make sure all out config files have the correct values. Open up **app/config/config.json** and supply your OpenHIM config details and save:

```json
"api": {
  "username": "root@openhim.org",
  "password": "openhim-password" [Please make sure you supply your updated password],
  "apiURL": "https://localhost:8080"
}
```

Open up **app/config/mediator.json** and supply your OpenHIM config details as follows. The details in this file will be used to register your mediator with and setup some useful configuration in the OpenHIM core.

```json
{
  ...
  "defaultChannelConfig": [
    {
      ...
      "urlPattern": "/encounters/.*",
      ...
      "allow": ["tut"],
      ...
    }
  ],
  ...
}
```

Once the config has been supplied correctly we should have a Mediator that can be registered with the OpenHIM-core successfully. This registration will actually create a default channel for the mediator using the config that we have just supplied above. This allows your mediator to create its own channel so that a user doesn't have to do this via the OpenHIM console unless they want to change the defaults that we set. You can also supply endpoints in this config file, these will show up in the OpenHIM console so that you may easily connect to mediators. You will see this has already been filled out for you! Next, open up **app/index.js**. We will be creating a new endpoint which our Mediator will be listening on. Whenever that endpoint gets a request we will route the request onto our Health Record service.

First, let's setup the endpoint. Update the default endpoint that was created for you with the generator to listen on '/encounters/:id' just like the mock server does (this doesn't have to be the same, but it makes it easier for us).

```js
// listen for requests coming through on /encounters/:id
app.get('/encounters/:id', function (req, res) {

})
```

Inside the endpoint we created above we will make a request to the service we are trying to reach. In this case it is the Health Record service. To make this easier we will use a module called **needle**. First we need to add our **needle** module to our dependencies:

`$ npm install needle --save`

We also need to make sure that we require our **needle** module at the top of the script:

```js
...
var app = express()
var needle = require('needle');
```

Now we need to send our **needle** request to our Health Record service, this should be done inside the function we created above and should wrap the existing code that was generated.

```js
//send HTTP request to Health Record service
needle.get('http://localhost:3444/encounters/'+req.params.id, function(err, resp) {
  ... existing generated code ...
});
```

NB! make sure that you request path is correct. IE the endpoint is reachable We will now be working inside the request we are making to the Health Record Service. Add an error exception log message

```js
// check if any errors occurred
if (err){
  console.log(err)
  return;
}
```

Mediator are able to communicate metadata back to the OpenHIM-core. This metadata includes details about the requests that the mediator made to other serves and the responses that it received. Each request that the mediator makes to other services are called orchestrations. We need to build up a orchestration object for the request that we are sending to the Health Record service. Below the error handling that we just added update the context object and orchestration data that the generator pre-populated for you with the following data:

```js
/* ######################################### */
/* ##### Create Initial Orchestration  ##### */
/* ######################################### */

// context object to store json objects
var ctxObject = {};
ctxObject['encounter'] = resp.body;

//Capture 'encounter' orchestration data 
orchestrationsResults = [];
orchestrationsResults.push({
  name: 'Get Encounter',
  request: {
    path : req.path,
    headers: req.headers,
    querystring: req.originalUrl.replace( req.path, "" ),
    body: req.body,
    method: req.method,
    timestamp: new Date().getTime()
  },
  response: {
    status: resp.statusCode,
    body: JSON.stringify(resp.body, null, 4),
    timestamp: new Date().getTime()
  }
});
```

This data will be used in the OpenHIM console so show what this mediator did to the message. Each step that a mediator performs to process a message, be it making a request to an external service or just transforming the message to another format, is called an orchestration. Here we have just created a single orchestration as the mediator doesn't do anything except pass the message along. The request and response data can be easily set depending on what we send and receive from the mock service. Next, we will edit the response object to tell the OpenHIM core what we want to return to the client. We will also attach the orchestration that we created above. This is the response that we will build up and return the the OpenHIM core:

```js
/* ###################################### */
/* ##### Construct Response Object  ##### */
/* ###################################### */

var urn = mediatorConfig.urn;
var status = 'Successful';
var response = {
  status: resp.statusCode,
  headers: {
    'content-type': 'application/json'
  },
  body: JSON.stringify(resp.body, null, 4),
  timestamp: new Date().getTime()
};

// construct property data to be returned - this can be anything interesting that you want to make available in core, or nothing at all
var properties = {};
properties[ctxObject.encounter.observations[0].obsType] = ctxObject.encounter.observations[0].obsValue + ctxObject.encounter.observations[0].obsUnit;
properties[ctxObject.encounter.observations[1].obsType] = ctxObject.encounter.observations[1].obsValue + ctxObject.encounter.observations[1].obsUnit;
properties[ctxObject.encounter.observations[2].obsType] = ctxObject.encounter.observations[2].obsValue + ctxObject.encounter.observations[2].obsUnit;
properties[ctxObject.encounter.observations[3].obsType] = ctxObject.encounter.observations[3].obsValue + ctxObject.encounter.observations[3].obsUnit;
properties[ctxObject.encounter.observations[4].obsType] = ctxObject.encounter.observations[4].obsValue + ctxObject.encounter.observations[4].obsUnit;
properties[ctxObject.encounter.observations[5].obsType] = ctxObject.encounter.observations[5].obsValue + ctxObject.encounter.observations[5].obsUnit;

// construct returnObject to be returned
var returnObject = {
  "x-mediator-urn": urn,
  "status": status,
  "response": response,
  "orchestrations": orchestrationsResults,
  "properties": properties
}
```

Once we have our return object setup correctly we will send the response back to the OpenHIM core. The generator should have already created this code for you.

```js
// set content type header so that OpenHIM knows how to handle the response
res.set('Content-Type', 'application/json+openhim');
res.send(returnObject);
```

Your OpenHIM Mediator should be completed now. Lets fire-up the server and see if it registered correctly. You can start the server with:

`$ grunt serve`

You should see the below message if your Mediator started/registered successfully:

`Attempting to create/update mediator Mediator has been successfully created/updated.`

Navigate to the **Mediators** section on OpenHIM console to see your Mediator`

## Java Mediator

The below steps will guide you on how to scaffold a new Java Mediator through Yeoman. First, lets create a directory where our Mediator will be created. Create a folder called **tutorialmediator**

`$ mkdir tutorialmediator cd tutorialmediator`

To create a scaffolded Mediator through Yeoman you will need to download the npm **generator-mediator-java** module. execute the following command:

`$ npm install -g generator-mediator-java`

Now lets create our scaffold Mediator. There are two ways to execute the yo command. Either way is fine. Bring up the Yeoman menu with all generators listed:

`$ yo`

Or start the process for creating a Mediator:

`$ yo mediator-java`

Fill out the questions that are asked by Yeoman. These are used to create your configuration.

*   What is your Mediator's name?: **Tutorial Mediator**
*   What does your Mediator do?: **This is the mediator being used in the tutorial**
*   What is your group ID?: **tutorial**
*   What artifact ID do you want to use?: **tutorial-mediator**
*   What package do you want to use for the source code?: **tutorial**
*   Under what port number should the mediator run?: **4000**
*   What is your primary route path?: **/encounters**

You have successfully created your scaffolded Mediator! Now we can proceed. Import the project into your favourite IDE. You will see that Yeoman has created a maven project for you that contains the mediator code. In the folder **src/main/resources** are configuration files for the mediator. In addition, Yeoman will have scaffolded three source files:

*   src/main/java/tutorial/MediatorMain.java
*   src/main/java/tutorial/DefaultOrchestrator.java
*   src/test/java/tutorial/DefaultOrchestratorTest.java

**MediatorMain**, like the name implies, contains the main entry point for the mediator. In addition it also loads the configuration. Here we will need to make a small edit in order to setup our routing from the HIM. In the **MediatorMain** class, there's a method called **buildRoutingTable()**. This is the configuration for the endpoints. Like the previous tutorial, we want to route to **/encounters/{anything}**, rather than just **/encounters**. Therefore, change the line

```java
routingTable.addRoute("/encounters", DefaultOrchestrator.class);
```

to

```java
routingTable.addRegexRoute("/encounters/.*", DefaultOrchestrator.class);
```

This tells the mediator engine that the **DefaultOrchestrator** class will handle any requests on the **/encounters/{anything}** endpoint. After this change we'll also need to ensure that the HIM Core will know how to route correctly to the mediator, so lets make sure all our config files have the correct values. Open up **src/main/resources/mediator.properties** and supply your OpenHIM config details and save:

```sh
mediator.name=Tutorial-Mediator
# you may need to change this to 0.0.0.0 if your mediator is on another server than HIM Core
mediator.host=localhost
mediator.port=4000
mediator.timeout=60000

core.host=localhost
core.api.port=8080
# update your user information if required
core.api.user=root@openhim.org
core.api.password=openhim-password
```

Open up **src/main/resources/mediator-registration-info.json** and update the details to match our new mediator path:

```js
{
  ...
  "endpoints": [
    {
      ...
      "path": "..." //remove this
    }
  ],
  "defaultChannelConfig": [
    {
      "urlPattern": "/encounters/.*",
      ...
      "routes": [
        {
          ...
          "path": "..." //remove this
          ...
        }
      ]
    }
  ]
}
```

Next, take a look at **src/main/java/tutorial/DefaultOrchestrator.java**. This is the main landing point for requests from the HIM Core and this is the main starting point for writing your mediator code. The mediator engine uses the [Akka](http://akka.io) framework, and **DefaultOrchestator** is an actor for processing requests. For now we will just setup a pass-through to the health record service, therefore you can edit the code as follows:

```java
package tutorial;

import akka.actor.ActorSelection;
import akka.actor.UntypedActor;
import akka.event.Logging;
import akka.event.LoggingAdapter;
import org.openhim.mediator.engine.MediatorConfig;
import org.openhim.mediator.engine.messages.MediatorHTTPRequest;
import org.openhim.mediator.engine.messages.MediatorHTTPResponse;

import java.util.HashMap;
import java.util.Map;

public class DefaultOrchestrator extends UntypedActor {
    LoggingAdapter log = Logging.getLogger(getContext().system(), this);

    private final MediatorConfig config;

    private MediatorHTTPRequest originalRequest;

    public DefaultOrchestrator(MediatorConfig config) {
        this.config = config;
    }

    private void queryHealthRecordService(MediatorHTTPRequest request) {
        log.info("Querying the health record service");
        originalRequest = request;

        ActorSelection httpConnector = getContext().actorSelection(config.userPathFor("http-connector"));
        Map <string, string="">headers = new HashMap<>();
        headers.put("Accept", "application/json");

        MediatorHTTPRequest serviceRequest = new MediatorHTTPRequest(
                request.getRequestHandler(),
                getSelf(),
                "Health Record Service",
                "GET",
                "http",
                "localhost",
                3444,
                request.getPath(),
                null,
                headers,
                null
        );

        httpConnector.tell(serviceRequest, getSelf());
    }

    private void processHealthRecordServiceResponse(MediatorHTTPResponse response) {
        log.info("Received response from health record service");
        originalRequest.getRespondTo().tell(response.toFinishRequest(), getSelf());
    }

    @Override
    public void onReceive(Object msg) throws Exception {
        if (msg instanceof MediatorHTTPRequest) {
            queryHealthRecordService((MediatorHTTPRequest) msg);
        } else if (msg instanceof MediatorHTTPResponse) {
            processHealthRecordServiceResponse((MediatorHTTPResponse) msg);
        } else {
            unhandled(msg);
        }
    }
}
```

When a request is received from core, the mediator engine will send a message to **onReceive**. When this happens we can trigger a request to the health record service, which we can do by referencing the **http-connector**. The http-connector is an actor provided by the engine for interacting with HTTP services. We look up this connector using an **ActorSelection** and send it an HTTP Request message, setting up the appropriate parameters for calling the health record service. When the connector receives a response from the health record service, it will respond to us by sending a HTTP Response message. Therefore in **onReceive**, we add handling for **MediatorHTTPResponse** and when receiving it we respond to the HIM Core with the health record. The original request (MediatorHTTPRequest) provides us with a handle for responding, and we can simply pass along the response message. Note that for orchestrator we don't need to worry about threading, blocking or anything like that: the Akka framework takes care of all of that! For this tutorial we'll just disable the unit test for the class (**src/test/java/tutorial/DefaultOrchestratorTest.java**), just add the **@Ignore** annotation:

```java
...
@Test
@Ignore
public void testMediatorHTTPRequest() throws Exception {
...
```

Feel free to complete this test if you want to get the hang of writing these! (Tip: the **org.openhim.mediator.engine.testing.MockHTTPConnector** class can be used to setup a mock endpoint) Now we're ready to build and launch our mediator.

```
$ mvn install
$ java -jar target/tutorial-mediator-0.1.0-jar-with-dependencies.jar
```

### SunCertPathBuilderException: unable to find valid certification path to requested target

If you are attempting to start your Java Mediator and you are experiencing a **SunCertPathBuilderException** error then you will need to follow the below mini tutorial to install the self signed certificate before you can continue. This mini tutorial is a short and quick version to get your self signed certificate installed. A more detailed and in-depth explanation can be found [here](http://www.mkyong.com/webservices/jax-ws/suncertpathbuilderexception-unable-to-find-valid-certification-path-to-requested-target/). Lets start by first creating a new folder where we will install our self signed certificate.

```
$ mkdir installCert
$ cd installCert
```

Download the [InstallCert.java.zip](../_static/mediators/InstallCert.java.zip "InstalCert.java.zip") folder and extract the **InstallCert.java** script into our new **installCert** directory. We need to compile our **InstallCert.java** script to generate a **jssecacerts** file for us. Lets start this off by executing the below command which will generate two Java **.class** files for us:

`$ javac InstallCert.java`

Once you have compiled the **InstallCert.java** script we need to execute it by running the following command:

`$ java InstallCert localhost:8080`

Make sure that the port you supply is the same as the OpenHIM core API (**default is 8080**). The script will start executing and request that you **enter certificate to add to trusted keystore**. just reply with **1** and the script will continue executing. Once the script has completed successfully you should a message printed at the bottom reading **Added certificate to keystore 'jssecacerts' using alias 'localhost-1'** The **installCert** script has executed successfully and created a **jssecacerts** file for us which we need to copy to our **$JAVA_HOME\jre\lib\security** folder. Once you have placed the **jssecacerts** in the correct folder then you can start the mediator again and **SunCertPathBuilderException** error should no longer exist. **NB! You will need to restart your Mediator before the self signed certificate takes affect**

`$ java -jar target/tutorial-mediator-0.1.0-jar-with-dependencies.jar`

Navigate to the **Mediators** section on OpenHIM to see your Mediator`

## Testing your shiny new mediator

Lets move onto the next part of this tutorial. You will notice that when our Mediator got registered it also created a channel for us. We will be using this Channel (**Tutorial Mediator**) You can delete the channel (**Tutorial Channel**) as it is no longer needed. Make sure that your services are running as explained in the pre-requisite section. Execute the CURL command to send a request to OpenHIM core and run through our Mediator

`$ curl -k -u tut:tut https://localhost:5000/encounters/1`

### Internal Server Error

If you get an **Internal Server Error** then make sure that your service is running and that **Tutorial Mediator** is able to route to it. Update your channel route to use your inet addr instead of localhost

`Example: Channel -> route -> Host: 192.168.1.10`


Your transaction should have routed through the mediator successfully and responded with the correct return object. You should notice a **Successful** record in your transactions on the OpenHIM console with the results. You can explore the transaction details page by clicking on the transaction in this list to see some of the details that we set in the mediator.
