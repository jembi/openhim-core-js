Orchestration with a mediator
=============================

In the previous tutorial we adapted the JSON response into HTML for easier viewing. In this tutorial we will learn how to enrich the response body with additional data by creating two orchestrations. This means we will be making a few requests to our tutorial services and joining them all together in the main response body.

This tutorial assumes that you have successfully completed the **Update Mediator for HTML Conversion** tutorial which we will be using to do our orchestrations.

## NodeJS Mediator

For this tutorial we will be executing our Orchestrations asynchronously. For us to accomplish this we need to install another npm module called async. Run the below command to install and save it to our dependency list.

`$ npm install async --save`

We need to include our new module into our mediator so lets add it at the top of our script

```js
...
var needle = require('needle');
var async = require('async');
```

Below the **Create Initial Orchestration** section we will be creating an array to store our orchestration requests

```js
/* ######################################### */
/* ##### setup Orchestration Requests  ##### */
/* ######################################### */

// setup more orchestrations
orchestrations = [{ 
    ctxObjectRef: "client",
    name: "Get Client", 
    domain: "http://localhost:3445",
    path: "/patient/"+resp.body.patientId,
    params: "",
    body: "",
    method: "GET",
    headers: ""
  }, { 
    ctxObjectRef: "provider",
    name: "Get Provider", 
    domain: "http://localhost:3446",
    path: "/providers/"+resp.body.providerId,
    params: "",
    body: "",
    method: "GET",
    headers: ""
  }];
```

Below the **Setup Orchestration Requests** section we will start our async code

```js
/* ###################################### */
/* ##### setup Async Orch Requests  ##### */
/* ###################################### */

// start the async process to send requests
async.each(orchestrations, function(orchestration, callback) {

  // code to execute the orchestrations

}, function(err){

  // This section will execute once all requests have been completed
  // if any errors occurred during a request the print out the error and stop processing
  if (err){
    console.log(err)
    return;
  }

});
```

We will now have a look at the heart of the orchestrations. Inside the **async.each** replace **// code to execute the orchestrations** with the below code. This is the code that will send each orchestration request and push the orchestration data to the **orchestrationsResults** object

```js
// construct the URL to request
var orchUrl = orchestration.domain + orchestration.path + orchestration.params;

// send the request to the orchestration
needle.get(orchUrl, function(err, resp) {

  // if error occured
  if ( err ){
    callback(err);
  }

  // add new orchestration to object
  orchestrationsResults.push({
    name: orchestration.name,
    request: {
      path : orchestration.path,
      headers: orchestration.headers,
      querystring: orchestration.params,
      body: orchestration.body,
      method: orchestration.method,
      timestamp: new Date().getTime()
    },
    response: {
      status: resp.statusCode,
      body: JSON.stringify(resp.body, null, 4),
      timestamp: new Date().getTime()
    }
  });

  // add orchestration response to context object and return callback
  ctxObject[orchestration.ctxObjectRef] = resp.body;
  callback();
});
```

We need to move our **HTML conversion** code and our **Construct Response Object** into our async process. We can place this directly after the check for any errors as this code should execute if no errors exist. Your async process should look like the below:

```js
/* ###################################### */
/* ##### setup Async Orch Requests  ##### */
/* ###################################### */
 
// start the async process to send requests
async.each(orchestrations, function(orchestration, callback) {
 
  // construct the URL to request
  var orchUrl = orchestration.domain + orchestration.path + orchestration.params;
 
  // send the request to the orchestration
  needle.get(orchUrl, function(err, resp) {
 
    // if error occured
    if ( err ){
      callback(err);
    }
 
    // add new orchestration to object
    orchestrationsResults.push({
      name: orchestration.name,
      request: {
        path : orchestration.path,
        headers: orchestration.headers,
        querystring: orchestration.params,
        body: orchestration.body,
        method: orchestration.method,
        timestamp: new Date().getTime()
      },
      response: {
        status: resp.statusCode,
        body: JSON.stringify(resp.body, null, 4),
        timestamp: new Date().getTime()
      }
    });
 
    // add orchestration response to context object and return callback
    ctxObject[orchestration.ctxObjectRef] = resp.body;
    callback();
  });
 
}, function(err){
 
  // if any errors occured during a request the print out the error and stop processing
  if (err){
    console.log(err)
    return;
  }
 
  /* ############################ */
  /* ##### HTML conversion  ##### */
  /* ############################ */
 
  /* ##### Construct Encounter HTML  ##### */
  // first loop through all observations and build HTML rows
  var observationsHtml = '';
  for (i = 0; i < ctxObject.encounter.observations.length; i++) { 
    observationsHtml += '    <tr>' + "\n" +
    '      <td>'+ctxObject.encounter.observations[i].obsType+'</td>' + "\n" +
    '      <td>'+ctxObject.encounter.observations[i].obsValue+'</td>' + "\n" +
    '      <td>'+ctxObject.encounter.observations[i].obsUnit+'</td>' + "\n" +
    '    </tr>' + "\n";
  }
 
  // setup the encounter HTML
  var healthRecordHtml = '  <h3>Patient ID: #'+ctxObject.encounter.patientId+'</h3>' + "\n" +
  '  <h3>Provider ID: #'+ctxObject.encounter.providerId+'</h3>' + "\n" +
  '  <h3>Encounter Type: '+ctxObject.encounter.encounterType+'</h3>' + "\n" +
  '  <h3>Encounter Date: '+ctxObject.encounter.encounterDate+'</h3>' + "\n" +
  '  <table cellpadding="10" border="1" style="border: 1px solid #000; border-collapse: collapse">' + "\n" +
  '    <tr>' + "\n" +
  '      <td>Type:</td>' + "\n" +
  '      <td>Value:</td>' + "\n" +
  '      <td>Unit:</td>' + "\n" +
  '    </tr>' + "\n" +
  observationsHtml + 
  '  </table>' + "\n";
 
  // setup the main response body
  var responseBodyHtml = '<html>' + "\n" +
  '<body>' + "\n" +
  '  <h1>Health Record</h1>' + "\n" +
  healthRecordHtml +
  '</body>' + "\n" +
  '</html>';
 
  /* ###################################### */
  /* ##### Construct Response Object  ##### */
  /* ###################################### */
 
  var urn = mediatorConfig.urn;
  var status = 'Successful';
  var response = {
    status: 200,
    headers: {
      'content-type': 'application/json'
    },
    body: responseBodyHtml,
    timestamp: new Date().getTime()
  };
 
  // construct property data to be returned
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
 
  // set content type header so that OpenHIM knows how to handle the response
  res.set('Content-Type', 'application/json+openhim');
  res.send(returnObject);
 
});
```

We have a few more small additions to add before we have our Orchestration mediator complete. These steps are not crucial for the mediator to work but rather adds more value to the returned result. We will be updated the HTML that gets returned to include the patient details as well as the provider details that we retrieve in the orchestration calls that we make. Supply the below code underneath the **healthRecordHtml** variable.

```js
/* ##### Construct patient HTML  ##### */
var patientRecordHtml = '  <h2>Patient Record: #'+ctxObject.client.patientId+'</h2>' + "\n" +
'  <table cellpadding="10" border="1" style="border: 1px solid #000; border-collapse: collapse">' + "\n" +
'    <tr>' + "\n" +
'      <td>Given Name:</td>' + "\n" +
'      <td>'+ctxObject.client.givenName+'</td>' + "\n" +
'    </tr>' + "\n" +
'    <tr>' + "\n" +
'      <td>Family Name:</td>' + "\n" +
'      <td>'+ctxObject.client.familyName+'</td>' + "\n" +
'    </tr>' + "\n" +
'    <tr>' + "\n" +
'      <td>Gender:</td>' + "\n" +
'      <td>'+ctxObject.client.gender+'</td>' + "\n" +
'    </tr>' + "\n" +
'    <tr>' + "\n" +
'      <td>Phone Number:</td>' + "\n" +
'      <td>'+ctxObject.client.phoneNumber+'</td>' + "\n" +
'    </tr>' + "\n" +
'  </table>' + "\n";
 
 
/* ##### Construct provider HTML  ##### */
var providerRecordHtml = '  <h2>Provider Record: #'+ctxObject.provider.providerId+'</h2>' + "\n" +
'  <table cellpadding="10" border="1" style="border: 1px solid #000; border-collapse: collapse">' + "\n" +
'    <tr>' + "\n" +
'      <td>Title:</td>' + "\n" +
'      <td>'+ctxObject.provider.title+'</td>' + "\n" +
'    </tr>' + "\n" +
'    <tr>' + "\n" +
'      <td>Given Name:</td>' + "\n" +
'      <td>'+ctxObject.provider.givenName+'</td>' + "\n" +
'    </tr>' + "\n" +
'    <tr>' + "\n" +
'      <td>Family Name:</td>' + "\n" +
'      <td>'+ctxObject.provider.familyName+'</td>' + "\n" +
'    </tr>' + "\n" +
'  </table>' + "\n";
```

We will also need to make sure that our new HTML variables gets added to our response body so lets add it to the **responseBodyHtml** variable.

```js
// setup the main response body
var responseBodyHtml = '<html>' + "\n" +
'<body>' + "\n" +
'  <h1>Health Record</h1>' + "\n" +
healthRecordHtml +
patientRecordHtml +
providerRecordHtml +
'</body>' + "\n" +
'</html>';
```

One last thing we will be doing before we finish off our mediator is to add two new properties. These two properties will be constructed from the patient and provider object we got from our orchestrations. Add the two below properties.

```js
var properties = {};
properties[ctxObject.client.givenName + ' ' + ctxObject.client.familyName + '(' + ctxObject.client.gender + ')'] = ctxObject.client.phoneNumber;
properties[ctxObject.provider.title] = ctxObject.provider.givenName + ' ' + ctxObject.provider.familyName;
...
```

Execute the following command to start up the server:

`$ grunt serve`

## Java Mediator

We will enrich the health record service response using information from the client-service and the healthcare-worker-service. First we should setup object classes that can model the data, so let's create a new class **Patient**:

```java
package tutorial;

public class Patient {
    private Integer patientId;
    private String familyName;
    private String givenName;
    private String gender;
    private String phoneNumber;

    public Integer getPatientId() {
        return patientId;
    }

    public void setPatientId(Integer patientId) {
        this.patientId = patientId;
    }

    public String getFamilyName() {
        return familyName;
    }

    public void setFamilyName(String familyName) {
        this.familyName = familyName;
    }

    public String getGivenName() {
        return givenName;
    }

    public void setGivenName(String givenName) {
        this.givenName = givenName;
    }

    public String getGender() {
        return gender;
    }

    public void setGender(String gender) {
        this.gender = gender;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }
}
```

and a new class **Provider**:

```java
package tutorial;

public class Provider {
    private Integer providerId;
    private String familyName;
    private String givenName;
    private String title;

    public Integer getProviderId() {
        return providerId;
    }

    public void setProviderId(Integer providerId) {
        this.providerId = providerId;
    }

    public String getFamilyName() {
        return familyName;
    }

    public void setFamilyName(String familyName) {
        this.familyName = familyName;
    }

    public String getGivenName() {
        return givenName;
    }

    public void setGivenName(String givenName) {
        this.givenName = givenName;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }
}
```

With these classes in place, we can look at orchestrating the requests. The flow we want to follow is

1.  Query health record service
2.  Lookup patient demographics for the patient with the id contained in the health record
3.  Lookup healthcare demographics for the provider with the id contained in the health record
4.  Convert the health record into HTML and insert the demographic information into this final response

Notice that both 2) and 3) can easily be separated from the health record orchestration, and in addition can easily run in parallel. Therefore, let's create separate actors for accomplishing these tasks. Let's create an actor for the task of resolving patients:

```java
package tutorial;

import akka.actor.ActorRef;
import akka.actor.UntypedActor;
import akka.event.Logging;
import akka.event.LoggingAdapter;
import org.openhim.mediator.engine.messages.MediatorRequestMessage;
import org.openhim.mediator.engine.messages.SimpleMediatorRequest;
import org.openhim.mediator.engine.messages.SimpleMediatorResponse;

public class ResolvePatientActor extends UntypedActor {
    public static class ResolvePatientRequest extends SimpleMediatorRequest <integer>{
        public ResolvePatientRequest(ActorRef requestHandler, ActorRef respondTo, Integer requestObject) {
            super(requestHandler, respondTo, requestObject);
        }
    }

    public static class ResolvePatientResponse extends SimpleMediatorResponse <patient>{
        public ResolvePatientResponse(MediatorRequestMessage originalRequest, Patient responseObject) {
            super(originalRequest, responseObject);
        }
    }

    LoggingAdapter log = Logging.getLogger(getContext().system(), this);
    private MediatorConfig config;

    public ResolvePatientActor(MediatorConfig config) {
        this.config = config;
    }

    @Override
    public void onReceive(Object msg) throws Exception {
        if (msg instanceof ResolvePatientRequest) {
            //...
        } else {
            unhandled(msg);
        }
    }
}
```

We've defined an actor **ResolvePatientActor** and created two message types for it: **ResolvePatientRequest** and **ResolvePatientResponse**. So we expect a request message that'll ask the actor to resolve a patient. Let's add handling for this:

```java
private ResolvePatientRequest originalRequest;

...

private void sendPatientRequest(ResolvePatientRequest request) {
    log.info("Querying the patient service");
    originalRequest = request;

    ActorSelection httpConnector = getContext().actorSelection(config.userPathFor("http-connector"));
    Map <string, string="">headers = new HashMap<>();
    headers.put("Content-Type", "application/json");

    String path = "/patient/" + request.getRequestObject();

    MediatorHTTPRequest serviceRequest = new MediatorHTTPRequest(
            request.getRequestHandler(),
            getSelf(),
            "Patient Service",
            "GET",
            "http",
            "localhost",
            3445,
            path,
            null,
            headers,
            null
    );

    httpConnector.tell(serviceRequest, getSelf());
}

@Override
public void onReceive(Object msg) throws Exception {
    if (msg instanceof ResolvePatientRequest) {
        sendPatientRequest((ResolvePatientRequest) msg);
    } else {
        unhandled(msg);
    }
}
```

When receiving a request, we will query the patient service for details matching the **requestObject**, here the patient id. Next we need to process the service response:

```java
private Patient parsePatientJSON(String patient) {
    Gson gson = new GsonBuilder().create();
    return gson.fromJson(patient, Patient.class);
}

private void processPatientServiceResponse(MediatorHTTPResponse response) {
    Patient p = parsePatientJSON(response.getBody());
    ResolvePatientResponse actorResponse = new ResolvePatientResponse(originalRequest, p);
    originalRequest.getRespondTo().tell(actorResponse, getSelf());
}

@Override
public void onReceive(Object msg) throws Exception {
    if (msg instanceof ResolvePatientRequest) {
        sendPatientRequest((ResolvePatientRequest) msg);
    } else if (msg instanceof MediatorHTTPResponse) {
        processPatientServiceResponse((MediatorHTTPResponse) msg);
    } else {
        unhandled(msg);
    }
}
```

Next let's setup the analogous actor for resolving healthcare workers (or providers, to use another term):

```java
package tutorial;

import akka.actor.ActorRef;
import akka.actor.ActorSelection;
import akka.actor.UntypedActor;
import akka.event.Logging;
import akka.event.LoggingAdapter;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import org.openhim.mediator.engine.MediatorConfig;
import org.openhim.mediator.engine.messages.*;

import java.util.HashMap;
import java.util.Map;

public class ResolveProviderActor extends UntypedActor {
    public static class ResolveProviderRequest extends SimpleMediatorRequest <integer>{
        public ResolveProviderRequest(ActorRef requestHandler, ActorRef respondTo, Integer requestObject) {
            super(requestHandler, respondTo, requestObject);
        }
    }

    public static class ResolveProviderResponse extends SimpleMediatorResponse <provider>{
        public ResolveProviderResponse(MediatorRequestMessage originalRequest, Provider responseObject) {
            super(originalRequest, responseObject);
        }
    }

    LoggingAdapter log = Logging.getLogger(getContext().system(), this);
    private MediatorConfig config;
    private ResolveProviderRequest originalRequest;

    public ResolveProviderActor(MediatorConfig config) {
        this.config = config;
    }

    private void sendProviderRequest(ResolveProviderRequest request) {
        log.info("Querying the healthcare worker service");
        originalRequest = request;

        ActorSelection httpConnector = getContext().actorSelection(config.userPathFor("http-connector"));
        Map <string, string="">headers = new HashMap<>();
        headers.put("Content-Type", "application/json");

        String path = "/providers/" + request.getRequestObject();

        MediatorHTTPRequest serviceRequest = new MediatorHTTPRequest(
                request.getRequestHandler(),
                getSelf(),
                "Provider Service",
                "GET",
                "http",
                "localhost",
                3446,
                path,
                null,
                headers,
                null
        );

        httpConnector.tell(serviceRequest, getSelf());
    }

    private Provider parseProviderJSON(String provider) {
        Gson gson = new GsonBuilder().create();
        return gson.fromJson(provider, Provider.class);
    }

    private void processProviderServiceResponse(MediatorHTTPResponse response) {
        Provider p = parseProviderJSON(response.getBody());
        ResolveProviderResponse actorResponse = new ResolveProviderResponse(originalRequest, p);
        originalRequest.getRespondTo().tell(actorResponse, getSelf());
    }

    @Override
    public void onReceive(Object msg) throws Exception {
        if (msg instanceof ResolveProviderRequest) {
            sendProviderRequest((ResolveProviderRequest) msg);
        } else if (msg instanceof MediatorHTTPResponse) {
            processProviderServiceResponse((MediatorHTTPResponse) msg);
        } else {
            unhandled(msg);
        }
    }
}
```

Now that we've got our actors, we can proceed with setting up the orchestrations in **DefaultOrchestrator**. Add two variables for keeping track of the orchestrations, as well as a variable for storing the parsed health record:

```java
private HealthRecord healthRecord;
private Patient resolvedPatient;
private Provider resolvedProvider;
```

Next, after receiving the response from the health record service, instead of converting the record to HTML, we will use this point to create the resolve requests:

```java
private void processHealthRecordServiceResponse(MediatorHTTPResponse response) {
    log.info("Received response from health record service");

    if (response.getStatusCode() == HttpStatus.SC_OK) {
        healthRecord = parseHealthRecordJSON(response.getBody());

        //Resolve patient
        ResolvePatientActor.ResolvePatientRequest patientRequest = new ResolvePatientActor.ResolvePatientRequest(
                originalRequest.getRequestHandler(), getSelf(), healthRecord.getPatientId()
        );
        ActorRef patientResolver = getContext().actorOf(Props.create(ResolvePatientActor.class, config));
        patientResolver.tell(patientRequest, getSelf());

        //Resolve healthcare worker
        ResolveProviderActor.ResolveProviderRequest providerRequest = new ResolveProviderActor.ResolveProviderRequest(
                originalRequest.getRequestHandler(), getSelf(), healthRecord.getProviderId()
        );
        ActorRef providerResolver = getContext().actorOf(Props.create(ResolveProviderActor.class, config));
        providerResolver.tell(providerRequest, getSelf());
    } else {
        originalRequest.getRespondTo().tell(response.toFinishRequest(), getSelf());
    }
}
```

Then we just need to wait for the responses, and when completed we can format the final result and respond to the client:

```java
private void finalizeRequest() {
    if (resolvedPatient==null || resolvedProvider==null) {
        //still waiting for results
        return;
    }

    String html = convertToHTML();
    FinishRequest fr = new FinishRequest(html, "text/html", HttpStatus.SC_OK);
    originalRequest.getRespondTo().tell(fr, getSelf());
}

@Override
public void onReceive(Object msg) throws Exception {
    if (msg instanceof MediatorHTTPRequest) {
        queryHealthRecordService((MediatorHTTPRequest) msg);
    } else if (msg instanceof MediatorHTTPResponse) {
        processHealthRecordServiceResponse((MediatorHTTPResponse) msg);
    } else if (msg instanceof ResolvePatientActor.ResolvePatientResponse) {
        resolvedPatient = ((ResolvePatientActor.ResolvePatientResponse) msg).getResponseObject();
        finalizeRequest();
    } else if (msg instanceof ResolveProviderActor.ResolveProviderResponse) {
        resolvedProvider = ((ResolveProviderActor.ResolveProviderResponse) msg).getResponseObject();
        finalizeRequest();
    } else {
        unhandled(msg);
    }
}
```

We've modified the **onReceive** method to wait for the response messages. When received we set the patient or provider objects and then check to see if the request can be finalized. As mentioned in a previous tutorial, we do not need to concern ourselves with threading or locks, as Akka will take care of all those aspects. Therefore we don't need to worry about synchronizing the **if (resolvedPatient==null || resolvedProvider==null)** line.

Lastly we just need to update the **convertToHTML** method:

```java
private String convertToHTML() {
    try {
        StringBuilder html = new StringBuilder("<html><body><h1>Health Record</h1>");
        String patientName = resolvedPatient.getGivenName() + " " + resolvedPatient.getFamilyName();
        html.append("<h3>Patient Name: " + patientName + "</h3>");
        html.append("<h3>Patient Gender: " + resolvedPatient.getGender() + "</h3>");
        html.append("<h3>Patient Phone: " + resolvedPatient.getPhoneNumber() + "</h3>");
 
        String providerName = resolvedProvider.getTitle() + " " + resolvedProvider.getGivenName() + " " + resolvedProvider.getFamilyName();
        html.append("<h3>Provider Name: " + providerName + "</h3>");
 
        html.append("<h3>Encounter Type: " + healthRecord.getEncounterType() + "</h3>");
 
        SimpleDateFormat from = new SimpleDateFormat("yyyymmdd");
        SimpleDateFormat to = new SimpleDateFormat("dd MMM yyyy");
        html.append("<h3>Encounter Date: " + to.format(from.parse(healthRecord.getEncounterDate())) + "</h3>");
 
        html.append("<table cellpadding=\"10\" border=\"1\" style=\"border: 1px solid #000; border-collapse: collapse\">");
        html.append("<tr>" +"<td>Type:</td>" +"<td>Value:</td>" +"<td>Unit:</td>" +"</tr>");
 
        for (HealthRecord.Observation obs : healthRecord.getObservations()) {
            html.append("<tr><td>" + obs.getObsType() + "</td><td>" + obs.getObsValue() + "</td><td>" + obs.getObsUnit() + "</td></tr>");
        }
 
        html.append("</table></body></html>");
        return html.toString();
    } catch (ParseException ex) {
        originalRequest.getRequestHandler().tell(new ExceptError(ex), getSelf());
    }
 
    return null;
}
```

And that's it. Let's bump up the version to **0.3.0**, as per the previous tutorial, and then build and run the mediator as before:

`$ mvn install`

`$ java -jar target/tutorial-mediator-0.3.0-jar-with-dependencies.jar`

## Testing your mediator

Try accessing the HIM using your web browser as per the previous tutorial: **https://localhost:5000/encounters/1**. You should not only see the health record, but also the patient and healthcare worker demographics! Also try looking at the transaction log in the HIM Console. You'll see that each orchestration is logged with the full request details with all the unformatted responses. We're all done :)