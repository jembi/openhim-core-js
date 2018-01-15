How to export/import Server Configuration
-----------------------------------------

**Note:** This can now be done directly from the OpenHIM console which may be easier. See [here](https://github.com/jembi/openhim-core-js/blob/master/docs/dev-guide/api-ref.md#metadata-resource).

### Exporting

Follow the steps belue to export and import the server metadata configuration manually. By default, the Users, Channels, Clients, ContactGroups and Mediators collections will be exported.
Copy the file [openhim-configuration-export.sh](https://github.com/jembi/openhim-core-js/blob/master/resources/openhim-configuration-export.sh) to a folder where you wish your export to be saved. Run the shell scrip by executing the following command:
`./openhim-configuration-export.sh`

Your exported collections should be located in the folder structure '/dump/openhim/'.

### Importing

To import you data successfully ensure that you are in the correct folder where the dump files are located. Execute the below command to  import your collections.
`mongorestore --db openhim dump/openhim`

NB! if you have changed your database name, then do so for the export/import as well.
NB! Please ensure that you stop the server before exporting and importing.