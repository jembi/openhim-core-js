Message adaption using a mediator
=================================

This tutorial is a follow on from the previous **Creating a basic passthrough Mediator** tutorial. This tutorial assumes that you fully completed the previous mediator and got it to successfully route to the Health Record service and respond with the correct data.

## NodeJS Mediator

In this tutorial we will be transforming the response we get from our Health Record service into a readable HTML format. This demonstrates the type of processing that a mediator could do, however it could also do much more. Depending on your project you may want to do a lot more processing into different formats or even enrich a message by making calls to external services to get extra information to include in the original message.

Let's get started, below the **Create Initial Orchestration** section in **app/index.js** we will be creating a variable that will hold our HTML converted response.

```js
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
```

Once we have created our HTML response, we need to include it in the object we return. Replace **body: JSON.stringify(resp.body, null, 4),** with **body: responseBodyHtml,** in the response body and set the content type to **text/html**.

```js
// update the response body with the 'responseBodyHtml' variable we created
var response = {
  ...
  headers: {
    'content-type': 'text/html'
  },
  body: responseBodyHtml,
  ...
};
```

Before we can test our updated mediator we first need to make sure we update our mediator version to indicate changes have been made. Open **package.json** and **app/config/mediator.json** and bump up the MINOR version by 1

```js
{
  ...
  "version": "0.2.0",
  ...
}
```

Once we have changed our version number we can start our mediator again. Execute the following command to start up the server:

`$ grunt serve`

## Java Mediator

In this tutorial we will be transforming the response we get from our Health Record service into a readable HTML format. From the last tutorial, we've already created a **processHealthRecordServiceResponse** method. Here we will be updating this method to convert the JSON response from the service into HTML. First we create a new class called **HealthRecord** to hold our health record model:

```java
package tutorial;

public class HealthRecord {
    public static class Observation {
        private String obsType;
        private String obsValue;
        private String obsUnit;

        public String getObsType() {
            return obsType;
        }

        public void setObsType(String obsType) {
            this.obsType = obsType;
        }

        public String getObsValue() {
            return obsValue;
        }

        public void setObsValue(String obsValue) {
            this.obsValue = obsValue;
        }

        public String getObsUnit() {
            return obsUnit;
        }

        public void setObsUnit(String obsUnit) {
            this.obsUnit = obsUnit;
        }
    }

    private Integer patientId;
    private Integer providerId;
    private String encounterType;
    private String encounterDate;
    private Observation[] observations;

    public Integer getPatientId() {
        return patientId;
    }

    public void setPatientId(Integer patientId) {
        this.patientId = patientId;
    }

    public Integer getProviderId() {
        return providerId;
    }

    public void setProviderId(Integer providerId) {
        this.providerId = providerId;
    }

    public String getEncounterType() {
        return encounterType;
    }

    public void setEncounterType(String encounterType) {
        this.encounterType = encounterType;
    }

    public String getEncounterDate() {
        return encounterDate;
    }

    public void setEncounterDate(String encounterDate) {
        this.encounterDate = encounterDate;
    }

    public Observation[] getObservations() {
        return observations;
    }

    public void setObservations(Observation[] observations) {
        this.observations = observations;
    }
}
```

Next, in the **DefaultOrchestrator** class, create a method **parseHealthRecordJSON**:

```java
private HealthRecord parseHealthRecordJSON(String healthRecord) {
    Gson gson = new GsonBuilder().create();
    return gson.fromJson(healthRecord, HealthRecord.class);
}
```

Now we'll be able to parse the health record response and use the model for HTML conversion. Let's set this up:

```java
private String convertToHTML(HealthRecord healthRecord) {
    try {
        StringBuilder html = new StringBuilder("<html><body><h1>Health Record</h1>");
        html.append("<h3>Patient ID: #" + healthRecord.getPatientId() + "</h3>");
        html.append("<h3>Provider ID: #" + healthRecord.getProviderId() + "</h3>");
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
 
private void processHealthRecordServiceResponse(MediatorHTTPResponse response) {
    log.info("Received response from health record service");
 
    if (response.getStatusCode() == HttpStatus.SC_OK) {
        HealthRecord healthRecord = parseHealthRecordJSON(response.getBody());
        String html = convertToHTML(healthRecord);
 
        FinishRequest fr = new FinishRequest(html, "text/html", HttpStatus.SC_OK);
        originalRequest.getRespondTo().tell(fr, getSelf());
    } else {
        originalRequest.getRespondTo().tell(response.toFinishRequest(), getSelf());
    }
}
```

Lastly, let's bump up the version. In **pom.xml**

```xml
<version>0.2.0</version>
```

and in **src/main/resources/mediator-registration-info.json**

```js
"version": "0.2.0",
```

You can now build and run your mediator as before:

`$ mvn install`

`$ java -jar target/tutorial-mediator-0.2.0-jar-with-dependencies.jar`

## Testing your mediator

Now instead of using the CURL command, try using your web browser to test out a transaction: **https://localhost:5000/encounters/1**. You'll be prompted for login details - enter **tut** for both username and password. You may also need to instruct your browser to accept the self-signed certificate. If you have any issues doing so, you can also use the unsecure port instead: http://localhost:5001/encounters/1\. You should now see the health record in your browser! The mediator has intercepted the request and done something useful with it.

You may create mediators for any additional processing that needs to occur for your project. Typical uses include **message transformation** (converting messages to a different format, either before they are send to another service or to convert the response from the other service as seen here) or for **message orchestration** (executing a business process for a message, eg. querying the client registry for an enterprise ID so that the message can be enriched with this information).