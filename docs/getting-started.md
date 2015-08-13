Getting started
===============

1. Install the latest stable [Node.js](http://nodejs.org/) 0.12.0 or greater.
2. Install and start [MongoDB](http://www.mongodb.org/) 2.4 or greater.
3. Install the OpenHIM-core package globally: `npm install openhim-core -g`, this will also install an openhim-core binary to your PATH.
4. Start the server by executing `openhim-core` from anywhere.

To make use of your own custom configurations you can copy the [default.json](https://github.com/jembi/openhim-core-js/blob/master/config/default.json) config file and override the default setting:

```
wget https://raw.githubusercontent.com/jembi/openhim-core-js/master/config/default.json
# edit default.json, then
openhim-core --conf=path/to/default.json
```

For more information about the config options, [click here](https://github.com/jembi/openhim-core-js/blob/master/config/config.md).

**Note:** one of the first things that you should do once the OpenHIM is up and running is setup a properly signed TLS certificate. You can do this through the [OpenHIM console](https://github.com/jembi/openhim-console) under 'Certificates' on the sidebar.
