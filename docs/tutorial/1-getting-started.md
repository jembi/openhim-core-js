Tutorial start
==============

Before getting started with the tutorials, please ensure that

*   the OpenHIM has been installed (see [here](../getting-started.html#installing-the-openhim-core "What is the easiest way to install the OpenHIM?") for tips on proceeding with this if not done so already)
*   the [tutorial services](../_static/mediators/openhim-tutorial-services.zip "Tutorial services") are set up and running.

The tutorial services consist of three mock health registries that we'll be routing to and retrieving data from during the tutorials. They provide simple endpoints, hosting mock patients, their health records and healthcare providers. Once you've downloaded the services, you will need to open up three terminals so that each service can be started individually. To do so, follow the below steps:

*   Unzip the folder and open up three terminal windows
*   Navigate to where you have unzipped your OpenHIM Tutorial Services
*   Make sure that all node dependencies are installed

`$ npm install`

For each of the services you will need to run following command in a new terminal:

`$ node health-record-service.js`

`$ node client-service.js`

`$ node healthcare-worker-service.js`

The service will indicate that it is running on a specific port. You can test these services by executing the following CURL commands and the below results should be displayed:

`$ curl http://localhost:3444/encounters/1`

```json
{
  "patientId": 1,
  "providerId": 1,
  "encounterType": "Physical Examination",
  "encounterDate": "20131023",
  "observations": [
    {
      "obsType": "Weight",
      "obsValue": "50",
      "obsUnit": "kg"
    },
    {
      "obsType": "Height",
      "obsValue": "160",
      "obsUnit": "cm"
    },
    {
      "obsType": "Systolic Blood Pressure",
      "obsValue": "120",
      "obsUnit": "mmHg"
    },
    {
      "obsType": "Diastolic Blood Pressure",
      "obsValue": "80",
      "obsUnit": "mmHg"
    },
    {
      "obsType": "Heartrate",
      "obsValue": "90",
      "obsUnit": "bpm"
    },
    {
      "obsType": "Temperature",
      "obsValue": "37",
      "obsUnit": "C"
    }
  ]
}
```

`$ curl http://localhost:3445/patient/1`

```json
{
  "patientId": 1,
  "familyName": "Patient",
  "givenName": "Sally",
  "gender": "F",
  "phoneNumber": "0731234567"
}
```

`$ curl http://localhost:3446/providers/1`

```json
{
  "providerId": 1,
  "familyName": "Doctor",
  "givenName": "Dennis",
  "title": "Dr"
}
```

Once you have these running you are ready to continute to the next tutorial.
