How to install on CentOS
====================================

## Install RPM package

RPM packages are provided for OpenHIM releases since v4.0.1. They may be downloaded from the [Github releases page](https://github.com/jembi/openhim-core-js/releases).

```bash
# example of downloading the package via the command line
wget https://github.com/jembi/openhim-core-js/releases/download/v4.0.1/openhim-core-v4.0.1.x86_64.rpm
```

The package can be installed with the following:

```bash
sudo yum install -y ~/rpmbuild/RPMS/x86_64/openhim-core-{current_version}.x86_64.rpm
sudo systemctl start openhim-core
# test that the OpenHIM is running
curl https://localhost:8080/heartbeat -k
```

Note: In order for openhim-core to run successfully, there needs to be a valid instance of MongoDB available for openhim-core to use. To install mongo-db locally execute the following on a CentOS system:

```bash
sudo yum install mongodb-org && service mongod start
```

Openhim-core's config can be modified by using environment variables:

```bash
export mongo_url="mongodb://<mongodb-IP-address>/<db-name>"
export mongo_atnaUrl="mongodb://<mongodb-IP-address>/<db-name>"
export NODE_ENV="production"
```

To install openhim-console:

```bash
sudo yum install -y ~/rpmbuild/RPMS/x86_64/openhim-console-{current_version}.x86_64.rpm
sudo systemctl start openhim-console
curl http://localhost:9000
```

Note: In order for openhim-console to run successfully, you'll need to point it to a valid instance of Openhim-core or install it locally. The openhim-console's configuration file can be found here:

```bash
/usr/lib/openhim-console/dist/config
```

## Let's talk NGINX

The rpm package for openhim-console uses the http-server package from npm to host and serve openhim-console. This is acceptable for development or test installations.

However it is recommended that NGINX be installed for production and staging servers. All openhim-console web traffic should be routed through NGINX; allowing NGINX to manage SSL certificates, data compression and port routing.

## Install SSL certificates

Please refer to [this](http://openhim.readthedocs.io/en/latest/how-to/how-to-setup-ssl-certs.html) on how to setup SSL certificates for OpenHIM.

## Backups

Important files to backup in order to restore Openhim, are as follows:

* Config file for openhim-core
* Config file for openhim-console
* Export and backup server metadata (Use the [import/export](http://openhim.readthedocs.io/en/latest/how-to/how-to-import-export.html) interface in openhim-console)
* All relevant certificates

These files will backup the configuration and settings for Openhim. The entire database will need to be backed-up in order to backup all historical data for transactions, audit events & certificates. It is recommended that a full database backup occurs on a regular basis. The configuration files only need to be backup when any of the configuration is updated or modified. Once the system has been setup, these configuration files are not expected to change too often.

## Upgrade paths

In order to upgrade Openhim, perform the following steps:

* It is important to perform a full backup before starting, to ensure the system can be restored if needed
* Proceed to building and installing the rpm packages for the new version of Openhim core and console. (You are able to upgrade only the core or console, as long as the new version remains compatible)
* Restore server metadata (use the Import interface in openhim-console)
* Update core & console config (not automated yet, needs to be done manually for each field)
* Restore database
* Test if upgrade worked

## Logging files

When Openhim is installed, all logs will be piped to standard output, which can be viewed as follows:

```bash
sudo systemctl status openhim-core
sudo tail -f -n 100 /var/log/messages
```
