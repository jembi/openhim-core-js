How to manually install on Ubuntu 14.04 Trusty
==============================================

The following is a quickstart tutorial to help guide you through the steps required for a new OpenHIM installation on a clean Ubuntu 14.04 instance.

This quickest an easiest way to install the OpenHIM on ubuntu is to use our deb package. This will install both he OpenHIM core and console on your server. See details on how to do this [here](../getting-started.html).

If you would like to install the OpenHIM manually, read on.

## Install Node.js

_As per [https://nodesource.com/blog/nodejs-v012-iojs-and-the-nodesource-linux-repositories](https://nodesource.com/blog/nodejs-v012-iojs-and-the-nodesource-linux-repositories)_ The first required dependency is Node.js. You should at least be running version 4. We can use NVM to get the latest node versions.

```sh
$ wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.32.1/install.sh | bash
$ nvm install --lts
```

## Install MongoDB 3.0

_As per [http://docs.mongodb.org/master/tutorial/install-mongodb-on-ubuntu](http://docs.mongodb.org/master/tutorial/install-mongodb-on-ubuntu)_ Next we need to setup MongoDB. At a minimum version 2.6 is required, but let's get version 3.0:

```sh
$ sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 7F0CEB10
$ echo "deb http://repo.mongodb.org/apt/ubuntu "$(lsb_release -sc)"/mongodb-org/3.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-3.0.list
$ sudo apt-get update
$ sudo apt-get install mongodb-org
```

## (optional) SSH User Fix - needed to use mongo client

You may run into an issue when trying to run the mongo command from the commandline via an SSH session:

```sh
$ jembi@openhim:~$ mongo
Failed global initialization: BadValue Invalid or no user locale set. Please ensure LANG and/or LC_* environment variables are set correctly.
```

This can be fixed as follows: Use your favourite text editor to open up `/etc/default/locale` and add the following line:

`LC_ALL="en_US.UTF-8"`

or use whichever locale is appropriate. Now log out and back in from your SSH session.

## Other prerequisites

Just some final dependencies before we move onto the HIM installation itself:

`$ sudo apt-get install git build-essential`

## OpenHIM Core

Now that all our dependencies are in place, let's proceed with installing the OpenHIM Core component:

`$ sudo npm install -g openhim-core`

This will download and install the latest version of core. Next we'll setup the configuration and an Ubuntu service.

### Configuration

Download a copy of the default core config and place it in _/etc_:

```sh
$ wget https://raw.githubusercontent.com/jembi/openhim-core-js/master/config/default.json
$ sudo mkdir /etc/openhim
$ sudo mv default.json /etc/openhim/core.json
```

You can now edit `/etc/openhim/core.json` and configure it as required for your instance.

### Setup the HIM core as a service

Download a copy of our default service configuration:

```sh
$ wget https://raw.githubusercontent.com/jembi/openhim-core-js/master/resources/openhim-core.conf
$ sudo mv openhim-core.conf /etc/init/
```

Next edit `/etc/init/openhim-core.conf` and edit the startup line to look as follows:

```
NODE_ENV=production openhim-core --conf=/etc/openhim/core.json --cluster=auto >> /var/log/openhim-core.log 2>&1
```

Here we're just setting up the startup command to use the configuration in /etc/openhim, as well as enabling automatic clustering; which will take advantage of your available CPU cores.

### Run and verify

Now we're ready to startup the HIM Core:

`$ sudo service openhim-core start`

You can verify and monitor the instance by looking at the logs:

`$ tail -f /var/log/openhim-core.log`

## OpenHIM Console

Next we need to setup the OpenHIM Console. Download the latest release from [https://github.com/jembi/openhim-console/releases/latest](https://github.com/jembi/openhim-console/releases/latest), e.g.:

`$ wget https://github.com/jembi/openhim-console/releases/download/v1.2.0/openhim-console-v1.2.0.tar.gz`

In this example we downloaded version 1.2.0, but it's a good idea to get the latest that is available. Next we need a web server to host the console; for this tutorial we'll use Nginx:

`$ sudo apt-get install nginx`

Now deploy the console:

```sh
$ cd /usr/share/nginx/html/
$ sudo tar -zxf ~/openhim-console-v1.2.0.tar.gz
```

Next we need to edit `/usr/share/nginx/html/config/default.json` and configure for the HIM core server. Simply set the host and port values to point to the address that the HIM core API will be available from. Note this host needs to be publicly accessible, e.g. the server's domain name or public IP address. When a client uses the HIM console, requests to the core API will be made "client-side" and not from the server. Now we can startup Nginx and start using the HIM:

`$ sudo service nginx start`

## Fin

The OpenHIM Core and Console should now be up and running! Access the console on http://yourserver and login with **root@openhim.org** using the password: **openhim-password** If there's a login issue, try accepting the self-signed cert in your browser on: _https://yourserver:8080/authenticate/root@openhim.org_
