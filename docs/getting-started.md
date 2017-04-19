Getting started
===============

To get started we will show you how to install the OpenHIM along with the admin console for easy configuration.

If you are on Ubuntu installing the OpenHIM is very easy as we provide a debian package in the openhie PPA. Just execute the following commands:

```sh
$ sudo add-apt-repository ppa:openhie/release
$ sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv EA312927
$ sudo echo 'deb http://repo.mongodb.org/apt/ubuntu trusty/mongodb-org/3.2 multiverse' | sudo tee /etc/apt/sources.list.d/mongodb-org-3.2.list
$ sudo apt-get update
$ sudo apt-get install openhim-core-js openhim-console
```

When installing the console, it will ask you for the host and port of the OpenHIM-core server. Make sure you provide the **public** hostname where the OpenHIM-core server will be accessible (localhost is fine if you are testing and just want access on your local machine). You can run `sudo dpkg-reconfigure openhim-console` at any time to specify a new OpenHIM-core host and port.

These packages will install the OpenHIM-core using NPM for the OpenHIM user, add the OpenHIM-core as a service and install the console to nginx. You can find the core log file here `/var/log/upstart/openhim-core.log` and may stop and start the OpenHIM-core with `sudo start openhim-core` or `sudo stop openhim-core`.

You should use the OpenHIM with a proper TLS certificate to secure your server. The easiest way to do this on a public server is to generate a free letsencrypt certificate. You can do this by following the commands below:

```sh
# These commands assume you are running as the root user
# fetch letsencrypt certbot script and make it executable
$ wget https://dl.eff.org/certbot-auto
$ chmod a+x certbot-auto

# Install certbot dependencies - if this fails and you have a small amount of ram then you may need to add a swapfile
$ ./certbot-auto
$ ./certbot-auto certonly --webroot -w /usr/share/openhim-console -d <your_hostname>

# allow the openhim the ability to read the generated certificate and key
$ chmod 750 /etc/letsencrypt/live/
$ chmod 750 /etc/letsencrypt/archive/
$ chown :openhim /etc/letsencrypt/live/ /etc/letsencrypt/archive/

# Change your OpenHIM cert config in /etc/openhim/config.json to (or enter these details when asked during the OpenHIM installation)
"certificateManagement": {
  "watchFSForCert": true,
  "certPath": "/etc/letsencrypt/live/<your_hostname>/fullchain.pem",
  "keyPath": "/etc/letsencrypt/live/<your_hostname>/privkey.pem"
}

# setup auto renewal of the certificate
$ crontab -e
# append the following line at the end of your crontab
0 0 * * * /root/certbot-auto renew --no-self-upgrade >> /var/log/letsencrypt-renewal.log
```

If you don't have ubuntu or want to install manually, follow the steps below.

Installing the OpenHIM-core
---------------------------

1. Install the latest stable [Node.js](http://nodejs.org/) v4 or greater. The latest [active LTS](https://github.com/nodejs/LTS) is recommended.
2. Install and start [MongoDB](http://www.mongodb.org/) 2.6 or greater.
3. Install Git apt-get install git
4. Install the OpenHIM-core package globally: `sudo npm install openhim-core -g`, this will also install an OpenHIM-core binary to your PATH.
5. Start the server by executing `openhim-core` from anywhere.

To make use of your own custom configurations you have two options. One, you can copy the [default.json](https://github.com/jembi/openhim-core-js/blob/master/config/default.json) config file and override the default settings:

```sh
wget https://raw.githubusercontent.com/jembi/openhim-core-js/master/config/default.json
# edit default.json, then
openhim-core --conf=path/to/default.json
```

Or two, you can use environment variables to set specific parameters. Environment variables use an _ as a separater for nested keys. For example, to change the port that the API listens on and to change the ports that the router listens on you could do the following: `api_httpsPort=8081 router_httpsPort=50456 router_httpPort=50457 npm start`. **Note**: the environment variables are case sensitive.

For more information about the config options, [click here](https://github.com/jembi/openhim-core-js/blob/master/config/config.md).

**Note:** one of the first things that you should do once the OpenHIM is up and running is setup a properly signed TLS certificate. You can do this later through the OpenHIM console under 'Certificates' on the sidebar.

Installing the OpenHIM admin console
------------------------------------

First ensure that you have the OpenHIM-core server up and running. The console communicates with the OpenHIM-core via its API to pull and display data.

Next, you need to pull down the latest release of the web app and deploy it to a web server (replace the X's in the below command to the [latest release](https://github.com/jembi/openhim-console/releases/latest)):

```sh
1. Download: wget https://github.com/jembi/openhim-console/releases/download/vX.X.X/openhim-console-vX.X.X.tar.gz
2. Create the /var/www/ path (If it does not already exist : sudo mkdir www
3. Navigate to the path /var/www/
4. Create the /var/www/html path (If it does not already exist) : sudo mkdir html
5. tar -vxzf openhim-console-vX.X.X.tar.gz --directory /var/www/html
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

Next, it is important to ensure that your OpenHIM Admin Console is able to communicate with the OpenHIM-Core. 
```sh
Make sure you have the latest Apache server installed:
sudo apt-get install apache2

Make sure the apache service is up and running:
sudo service apache2 status
```

Now, navigate to your web server and you should see the OpenHIM-console load (eg. `http://localhost/`) and login. The default username and password are:

* username: `root@openhim.org`
* password: `openhim-password`

You will be prompted to change this after your first successful login.

**Note:** You will have problems logging in if your OpenHIM server is still setup to use a self-signed certificate (the default). To get around this you can use the following workaround (the proper way to solve this is to upload a proper certificate into the OpenHIM-core):

> Visit the following link: `https://localhost:8080/authenticate/root@openhim.org` in Chrome. Make sure you are visiting this link from the system that is running the OpenHIM-core. Otherwise, replace `localhost` and `8080` with the appropriate OpenHIM-core server hostname and API port. You should see a message saying "Your connection is not private". Click "Advanced" and then click "Proceed". Once you have done this, you should see some JSON text displayed on the screen, you can ignore this and close the page. This will ignore the fact that the certificate is self-signed. Now, you should be able to go back to the Console login page and login. This problem will occur every now and then until you load a properly signed certificate into the OpenHIM-core server.

You now have the OpenHIM with admin console successfully up and running. From here you may want to checkout our tutorials or continue on to the user guide to learn more about how to configure your instance.
