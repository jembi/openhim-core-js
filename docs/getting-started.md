Getting started
===============

To get started we will show you how to install the OpenHIM along with the admin console for easy configuration.

Installing the OpenHIM core
---------------------------

1. Install the latest stable [Node.js](http://nodejs.org/) 0.12.0 or greater.
2. Install and start [MongoDB](http://www.mongodb.org/) 2.4 or greater.
3. Install the OpenHIM-core package globally: `npm install openhim-core -g`, this will also install an openhim-core binary to your PATH.
4. Start the server by executing `openhim-core` from anywhere.

To make use of your own custom configurations you can copy the [default.json](https://github.com/jembi/openhim-core-js/blob/master/config/default.json) config file and override the default setting:

```sh
wget https://raw.githubusercontent.com/jembi/openhim-core-js/master/config/default.json
# edit default.json, then
openhim-core --conf=path/to/default.json
```

For more information about the config options, [click here](https://github.com/jembi/openhim-core-js/blob/master/config/config.md).

**Note:** one of the first things that you should do once the OpenHIM is up and running is setup a properly signed TLS certificate. You can do this later through the OpenHIM console under 'Certificates' on the sidebar.

Installing the OpenHIM admin console
------------------------------------

First ensure that you have the OpenHIM-core server up and running. The console communicates with the OpenHIM-core via its API to pull and display data.

Next, you need to pull down the latest release of the web app and deploy it to a web server (replace the X's in the below command to the [latest release](https://github.com/jembi/openhim-console/releases/latest)):

```sh
wget https://github.com/jembi/openhim-console/releases/download/vX.X.X/openhim-console-vX.X.X.tar.gz
tar -vxzf openhim-console-vX.X.X.tar.gz --directory /var/www/
```

Next, and this step is _vital_, you need to configure the console to point to your OpenHIM-core server. Locate `config/default.js` in the folder you extracted the OpenHIM console to and edit it as follows:

```js
{
  "protocol": "https",
  "host": "localhost",  // change this to the hostname for your OpenHIM-core server (This hostname _MUST_ be publically accessible)
  "port": 8080,         // change this to the API port of the OpenHIM-core server, default is 8080 (This port _MUST_ be publically accessible)
  "title": "OpenHIM Admin Console", // You may change this to customise the title of the OpenHIM-console instance
  "footerTitle": "OpenHIM Administration Console", // You may change this to customise the footer of the OpenHIM-console instance
  "footerPoweredBy": "<a href='http://openhim.org/' target='_blank'>Powered by OpenHIM</a>",
  "loginBanner": ""     // add text here that you want to appear on the login screen, if any.
}
```

Now, navigate to your web server and you should see the OpenHIM-console load (eg. `http://localhost/`) and login. The default username and password are:

* username: `root@openhim.org`
* password: `openhim-password`

You will be prompted to change this.

**Note:** You will have problems logging in if your OpenHIM server is still setup to use a self-signed certificate (the default). To get around this you can use the following workaround (the proper way to solve this is to upload a proper certificate into the OpenHIM-core):

> Visit the following link: `https://localhost:8080/authenticate/root@openhim.org` in Chrome. Make sure you are visiting this link from the system that is running the OpenHIM-core. Otherwise, replace `localhost` and `8080` with the appropriate OpenHIM-core server hostname and API port. You should see a message saying "Your connection is not private". Click "Advanced" and then click "Proceed". Once you have done this, you should see some JSON, you can ignore this and close the page. Ths will ignore the fact that the certificate is self-signed. Now, you should be able to go back to the Console login page and login. This problem will occur every now and then until you load a properly signed certificate into the OpenHIM-core server.

You now have the OpenHIM with admin console successfully up and running. From here you may wante to checkout our tutorials or continue on to the user guide to learn more aboout how to configure your instance.
