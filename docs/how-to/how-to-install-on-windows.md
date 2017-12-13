How to manually install on Windows
==================================

The following is a quickstart tutorial to help guide you through the steps required for a new OpenHIM installation on a Windows instance.

## Install Node.js LTS

Install the latest LTS version of Node.js from their [official site](http://nodejs.org/). Note that the OpenHIM only officially supports the LTS edition of node, which is currently version 8.x

The official process should be suitable for the OpenHIM; simply download and run the installer msi.

## Install MongoDB

Install the latest version of MongoDB from their [official site](https://www.mongodb.org/)

As with Node.js, the official process should be suitable for the OpenHIM. Note however that MongoDB requires some additional steps after running the installer - in particular it would be a good idea to setup MongoDB as a service.

The following guide should help you get fully setup: https://docs.mongodb.org/manual/tutorial/install-mongodb-on-windows/

## OpenHIM Core

### Install

To install the OpenHIM Core, launch a Node.js command prompt via **Start > All Programs > Node.js > Node.js command prompt**. From here you can install Core using the following command
```
npm install -g openhim-core
```

You may see some warnings during the install process, especially if you do not have a C++ compiler installed, but this is not a problem and you can ignore these.

### Configuration

Create a folder for storing the OpenHIM config, e.g. `C:\OpenHIM` and grab a copy of the [default config](https://raw.githubusercontent.com/jembi/openhim-core-js/master/config/default.json) from github and save it to locally, e.g. `C:\OpenHIM\core.json`. Change this config to suit your needs.

You should now be able to run the OpenHIM Core. In a Node.js command prompt, run the following:
```
openhim-core --conf=C:\OpenHIM\core.json
```
or with whichever file location you chose to create for the config.

### Run as a Windows Service

To ensure the OpenHIM runs all the time, we will install it as a Windows Service using [NSSM](http://nssm.cc/download) (the Non-Sucking Service Manager)

1. Download [NSSM](http://nssm.cc/download) (the Non-Sucking Service Manager)
2. Open the archive and extract the `win32` or `win64` directory (depending on your Windows architecture) to a location on disk, for example `c:\nssm`
3. Add the location `c:\nssm` to your path, so that `nssm` is accessible without knowing and typing the whole path to the file on the command line
4. Open a command window with administrator privileges
5. Type `nssm install openhim-core "C:\Program Files\nodejs\node.exe"  "<insert-full-path>\node_modules\openhim-core\bin\openhim-core.js --conf=C:\OpenHIM\core.json"`
6. To capture the log output, type `nssm set openhim-core AppStdout "c:\OpenHIM\stdout.log`
7. To capture the error output, type `nssm set openhim-core AppStderr "c:\OpenHIM\stderr.log`
8. Type `net start openhim-core` to start the service or start it from the service manager.

You’re done. You’ve installed the OpenHIM as a windows service.

## OpenHIM Console

A web server will be required to host the OpenHIM Console and in this guide we will use IIS and as an alternative we will also explain how to use Nginx. However any good web server will be suitable, e.g.  Apache.

### Install IIS

Go to the [microsoft docs](http://www.iis.net/learn/install) for articles on how to install IIS for your particular flavour of Windows OS.

If you want to check if IIS is installed, browse to http://localhost in your browser. If an image pops up, then IIS has been installed correctly.


### Setup Console

Download the [latest Console release](https://github.com/jembi/openhim-console/releases/latest) and extract the contents into a folder such as `C:\OpenHIM\Console`. Note that you will need to use a utility such as [7-Zip](http://www.7-zip.org/) to extract the .tar.gz archive.

Console contains a config file located in `Console\config\default.json`. You will need to edit the `host` and `port` fields to point to the *public* address that the OpenHIM Core is running on. If you are only using the OpenHIM locally, then it is fine to leave the setting on localhost, however if you wish to make the Console accessible to other hosts, you will need to change the setting to either the machine's public IP address or domain name.

#### Configure the Console for IIS

Create a new site in Internet Information Services Manager. You can name it whatever you want. I'll call it Console in these instructions.
1. Start IIS Manager.
2. In the Connections panel, expand Sites
3. Right-click Sites and then click Add Web Site.
4. In the Add Web Site dialog box, fill in the required fields, for example:
   *   Site name: `Console`
   *   Physical path: `C:\OpenHIM\Console`
   *   Port: Make sure the port is something other than 80, as this will conflict with "Default Web Site" in IIS

### Alternative Web Server Instructions
#### Install Nginx

A web server will be required to host the OpenHIM Console and in this guide we will use Nginx. However any good web server will be suitable, e.g. Apache or IIS.

As per [this guide](https://www.nginx.com/resources/wiki/start/topics/tutorials/install/), download and extract the Nginx windows binary. You don't need to start nginx yet however.

#### Setup Console

Download the [latest Console release](https://github.com/jembi/openhim-console/releases/latest) and extract the contents into a folder such as `C:\OpenHIM\Console`. Note that you will need to use a utility such as [7-Zip](http://www.7-zip.org/) to extract the .tar.gz archive.

Console contains a config file located in `Console\config\default.json`. You will need to edit the `host` and `port` fields to point to the *public* address that the OpenHIM Core is running on. If you are only using the OpenHIM locally, then it is fine to leave the setting on localhost, however if you wish to make the Console accessible to other hosts, you will need to change the setting to either the machine's public IP address or domain name.

Next locate the Nginx configuration file `<nginx location>\conf\nginx.conf` and change the root context to point to the Console:
```
location / {
    root   C:\OpenHIM\Console;
    index  index.html index.htm;
}
```

Also change any other settings as required, e.g. port numbers.

Now you can startup Nginx from a command prompt by running:
```
cd <nginx location>
start nginx
```
## Fin

The OpenHIM Core and Console should now be up and running!

Access the console on http://yourserver:<port number> and login with **root@openhim.org** using the password: **openhim-password**
