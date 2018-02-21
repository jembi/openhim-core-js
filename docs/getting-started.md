# Getting started - How to install the OpenHIM

To get you started, we will show you the various options for installing the OpenHIM core along with the OpenHIM admin console.

If you are installing the OpenHIM on ubuntu, then the installation process is very easy as we provide a debian package in the OpenHIE Personal Package Archive (PPA). Currently, the packages are only built for Ubuntu 14.04 but we hope to support the latest LTS soon. The OpenHIM in general supports all versions of Ubuntu.

> **Note**: If you are installing the OpenHIM on a VM, please see [Installation using a Virtual Machine](#installation-using-a-virtual-machine) before proceeding with the installation of the OpenHIM.
___

### Installation using the PPA (Ubuntu v14.04 only)

When installing the console, it will ask you for the host and port number of the OpenHIM core server. Make sure that you provide the public hostname so that the OpenHIM core server may be accessible (localhost if testing from your local machine).
> **Note**: If you are running the OpenHIM on a local machine that is not public facing, you will need to specify the machines **IP address** as the hostname during the installation of the console. During the installation of the OpenHIM, you will be prompted with an option to choose an existing folder which contains certificates. Should you not have any existing certificate which you would like to add to the OpenHIM, please select _No_.

You can run `sudo dpkg-reconfigure openhim-console` at any time to specify a new OpenHIM core host and port number. These packages will install the OpenHIM core using Node Package Manager (NPM) for the OpenHIM user, add the OpenHIM-core as a service and install the OpenHIM console to Engine-X (nginx). The OpenHIM core log file can be found here /var/log/upstart/openhim-core.log. You may stop and start the OpenHIM core with `sudo start openhim-core` or `sudo stop openhim-core`

To install the OpenHIM core and console, just execute the following commands:

```sh
sudo add-apt-repository ppa:openhie/release
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv EA312927
sudo echo 'deb http://repo.mongodb.org/apt/ubuntu trusty/mongodb-org/3.2 multiverse' | sudo tee /etc/apt/sources.list.d/mongodb-org-3.2.list
sudo apt-get update
sudo apt-get install openhim-core-js openhim-console
```

> It is **recommended** that the OpenHIM be used with a proper Transport Layer Security (TLS) certificate to secure your server. The easiest way to do this on a public server is to generate a free Let’s Encrypt (letsencrypt) certificate. Let’s Encrypt certificate provides free X.509 certificates for TLS encryption. See their website for further information.

> **Note**: If your OpenHIM machine is running on a domain name that is not public facing, you will not be able to generate a certificate using letsencrypt. Instead, you will need to use a self-signed certificate. The next few steps will discuss how this works.

#### How to Generate a free Let’s Encrypt (letsencrypt) certificate

> **Note**: This section only applies to OpenHIM installations that have a public facing domain name. If you are running the OpenHIM on your local machine or on a virtual machine, you may continue with the self-signed certificate.

You are able to generate a free certificate by following these steps:

1. Fetch letsencrypt certbot script and make it executable (These commands assume you are running as the root user):
    ```sh
    wget https://dl.eff.org/certbot-auto
    chmod a+x certbot-auto
    ```
1. Install certbot dependencies (If this fails and you have a small amount of ram then you may need to add a swapfile):
    ```sh
    ./certbot-auto
    ./certbot-auto certonly --webroot -w /usr/share/openhim-console -d <your_hostname>
    ```
1. Allow the openhim the ability to read the generated certificate and key:
    ```sh
    chmod 750 /etc/letsencrypt/live/
    chmod 750 /etc/letsencrypt/archive/
    chown :openhim /etc/letsencrypt/live/ /etc/letsencrypt/archive/
    ```
1. Change your OpenHIM cert config in /etc/openhim/config.json to the following:
    ```json
    "certificateManagement": {
      "watchFSForCert": true,
      "certPath": "/etc/letsencrypt/live/<your_hostname>/fullchain.pem",
      "keyPath": "/etc/letsencrypt/live/<your_hostname>/privkey.pem"
    }

    (or enter these details when asked during the OpenHIM installation)
    ```
1. setup auto renewal of the certificate:
    ```sh
    crontab -e
    ```
1. append the following line at the end of your crontab:
    ```text
    0 0 * * * /root/certbot-auto renew --no-self-upgrade >> /var/log/letsencrypt-renewal.log
    ```

### Manual Installation

If you don’t have ubuntu or prefer to proceed with the installation manually, please follow the following steps.

#### Installing the OpenHIM Core

> The latest active LTS is **recommended**.

> **Note**: libappstream3 may cause problems with the npm package manager if your ubuntu instance is not fully updated.

1. Install the latest stable Node.js v4 or greater `curl -sL https://deb.nodesource.com/setup_6.x| sudo -E bash` then `sudo apt-get install -y nodejs`
1. Install and start MongoDB 2.6 or greater. (If you are running Ubuntu 16.04, you may want to  configure MongoDB as a systemd service that will automatically start on boot)
1. Install Git `apt-get install git`
1. Install npm `sudo apt install npm`
1. Install the OpenHIM-core package globally (this will also install an OpenHIM-core binary to your PATH) `sudo npm install openhim-core -g`
1. Start the server by executing `openhim-core` from anywhere.

To make use of your own custom configurations, you have two options:

1. You can copy the default.json config file and override the default settings: `wget https://raw.githubusercontent.com/jembi/openhim-core-js/master/config/default.json` edit default.json, then `openhim-core --conf=path/to/default.json`

1. You can use environment variables to set specific parameters. Environment variables use a _ as a separator for nested keys. For example, to change the port that the Application Programming Interface (API) listens on and to change the ports that the router listens on you could do the following: `api_httpsPort=8081 router_httpsPort=50456 router_httpPort=50457 npm start`

> **Note**: The environment variables are case sensitive.

For more information about the config options, please visit [OpenHIM Config Options](https://github.com/jembi/openhim-core-js/blob/master/config/config.md).

#### Installing the OpenHIM Console

Before installing the OpenHIM console, it is required that you first have the OpenHIM core server up and running. The OpenHIM console communicates with the OpenHIM core via its API to pull and display data.

> It is **recommended** that as soon as the OpenHIM core is up and running that you setup a properly signed TLS certificate. However, it is possible to do this later through the OpenHIM console under ‘Certificates’ on the left navigation pane.

Next, you need to download the latest release of the web app and deploy it to a web server (Replace the X’s in the below command to the latest release):

1. Get the latest release `sh wget https://github.com/jembi/openhim-console/releases/download/vX.X.X/openhim-console-vX.X.X.tar.gz`
1. Navigate to the path `cd /var`
1. Create the /var/www/ path (If it does not already exist) `sudo mkdir www`
1. Navigate to the path `cd www/`
1. Create the /var/www/html path (If it does not already exist) `sudo mkdir html`
1. Export the contents of the download `tar -vxzf openhim-console-vX.X.X.tar.gz --directory /var/www/html`

> The next step is vital for the successful setup of the OpenHIM console. Firstly, you need to configure the console to point to your OpenHIM core server and lastly, navigate to the config/default.js file in the folder that you extracted the OpenHIM console’s contents to and edit it as follows:

```js
{
  "version": "x.x.x", //Replace the x's with the latest release
  "minimumCoreVersion": "3.4.0",
  "protocol": "https",
  "host": "localhost",  // change this to the hostname for your OpenHIM-core server (This hostname _MUST_ be publically accessible)
  "port": 8080,         // change this to the API port of the OpenHIM-core server, default is 8080 (This port _MUST_ be publically accessible)
  "title": "OpenHIM Admin Console", // You may change this to customise the title of the OpenHIM-console instance
  "footerTitle": "OpenHIM Administration Console", // You may change this to customise the footer of the OpenHIM-console instance
  "footerPoweredBy": "<a href='http://openhim.org/' target='_blank'>Powered by OpenHIM</a>",
  "loginBanner": ""     // add text here that you want to appear on the login screen, if any.
  "mediatorLastHeartbeatWarningSeconds": 60,
  "mediatorLastHeartbeatDangerSeconds": 120
}
```

#### Ensure communication between the OpenHIM Console and Core

Make sure you have the latest Apache server installed `sudo apt-get install apache2`
Make sure the apache service is up and running `sudo service apache2 status`
___

### Installation using docker

The following steps will guide you through the process of installing the OpenHIM using docker images.

1. Install **Docker** via terminal `curl https://get.docker.com/ | sh -` Or install Docker using the link below, follow all the steps and most importantly, ensure that there is no previous docker installed while following these instructions. (https://docs.docker.com/engine/installation/linux/docker-ce/ubuntu/#install-using-the-repository)
1. Install **Docker Compose**, follow all the steps and use the recommend example version to install which is their latest stable release:  https://docs.docker.com/compose/install/#install-compose
1. Install Git `sudo apt-get install git`
1. Clone the repository for setting up a docker image `git clone https://github.com/jembi/openhim-common.git`
1. Navigate into the repo `cd openhim-common`
1. Build the docker images `docker-compose build && docker-compose up -d`
1. Access the OpenHIM Console on http://localhost:9000

> **Note**: To configure the IP address the user must do the following `sudo nano default.json` edit the hostname to be that of the IP address of the docker image.
___

### Installation using a Virtual Machine

When installing the OpenHIM on a VM that is running on your local machine, please take note of the following.

> Oracle's [VirtualBox](https://www.virtualbox.org/) is **recommended** for the setup of VMs.

#### Server Edition Linux

If you are running a server edition of Linux such as Ubuntu 16.04 LTS as a VM, you will need to configure a static IP address (or use DHCP if your network has a DHCP server) that falls within the same network block as the rest of your network. If your local machine is not part of a network, make sure that the network block for your local machine matches that of the VM.

For example, if your local machine IP address is 192.168.1.5 then the network block is 192.168.1.0 with a subnet mask of 255.255.255.0. This means that the hostname for the OpenHIM must contain the first three octets that is 192.168.1. The last octet must be unique such as 192.168.1.6.

When asked to configure the OpenHIM console during the OpenHIM installation process, you will need to specify the IP address which is the same IP address that has been assigned to the VMs eth0 interface.

- To verify the eth0 IP address, run the command `ifconfig -a`
- To change your eth0 network configuration, run the command `sudo vi /etc/network/interfaces`

You may also need to configure your local machine (the machine running the VM instance) network settings for the VM by changing the network adapter type to 'bridged' so that internet services will be possible as well as to access the OpenHIM console via your local machine internet browser.
> **Note**: This happens within the VM software itself, not in the installed server edition of linux.

#### Desktop Edition Linux

If you are running a desktop edition of Linux such as Ubuntu 14.04 LTS as a VM, you will be able to logon to the OpenHIM console directly from the VM by using localhost as your configured hostname.

Should you wish to access the OpenHIM console from your local machine, please follow the steps in [Server Edition Linux](#server-edition-linux).
___

## Logging in to the OpenHIM Console

The OpenHIM console is accessible by navigating to your web server.
> **Note**: The default port for the OpenHIM console is port **80**. It is possible to change this port in your NGINX configuration file. See [How to update your NGINX Config file](#how-to-update-your-nginx-config-file) for instructions on how to do this.

For example, assuming your web server host is your local machine, the Uniform resource Locator (URL) will be <http://localhost:80/>. The default OpenHIM administrator login credentials are as follows. Upon logging in, you will be prompted to customize your credentials so that it is more secure:

- Username: root@openhim.org
- Password: openhim-password

> **Note**: You will have problems logging in if your OpenHIM server is still setup to use a self-signed certificate (the default). Please see section **How to Generate a free Let’s Encrypt (letsencrypt) certificate** which identifies the steps necessary to generate a free certificate. If you choose to do this later, you may get around this by following these steps:

1. Visit the following link: https://localhost:8080/authenticate/root@openhim.org in Chrome.
    > **Note**: Make sure you are visiting this link from the system that is running the OpenHIM core. Otherwise, replace localhost and 8080 with the appropriate OpenHIM core server hostname (or IP Address) and API port.
1. You should see a message saying “Your connection is not private”. Click “Advanced” and then click “Proceed”.
1. Once you have done this, you should see some JSON text displayed on the screen, you can ignore this and close the page. This will ignore the fact that the certificate is self-signed.
1. Now, you should be able to go back to the OpenHIM console login page and login. This problem will occur every now and then until you load a properly signed certificate into the OpenHIM core server.

> The credentials used from this point will be considered the OpenHIM administrative account and is therefore highly recommended that you apply a strong password. General best practices in password creation that have been identified in this [article](https://www.symantec.com/connect/articles/simplest-security-guide-better-password-practices) may help you.
___

### How to update your NGINX Config file

The following steps guides you through the process of updating your NGINX config file for the purpose of changing the default listening port for the OpenHIM console:

1. Navigate to the NGINX config file `vim /etc/nginx/sites-enabled/openhim-console`
1. Add the following line directly after the curly bracket: listen 12345; // Where 12345 is the port number that you have chosen to use
1. Save and exit with the command :wq
1. Check your configuration for syntax errors `sudo nginx -t`
1. Refresh the NGINX config `service nginx reload`

Your NGINX configuration will then appear as follows:

```nginx
server {
  listen 12345;
  root /usr/share/openhim-console;
  index index.html;

  location / {
    try_files $uri $url/ =404;
  }
}
```
