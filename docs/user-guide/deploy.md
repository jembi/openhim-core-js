Deploying the OpenHIM
=====================

## OpenHIM Core

The easiest way to install core is as follows: **npm install openhim-core -g**. See the instructions [here](https://github.com/jembi/openhim-core-js).

## OpenHIM Console

The console comes [packaged](https://github.com/jembi/openhim-console/releases) such that you can just deploy the content straight to any good web server, such as Apache or Nginx. See the instructions [here](https://github.com/jembi/openhim-console).

## Ubuntu

If you're using an Ubuntu system (14.04 Trusty), you can also install the OpenHIM using the package manager: **sudo add-apt-repository ppa:openhie/release** **sudo apt-get update** **sudo apt-get install openhim-core-js openhim-console**

## Developers

For running the HIM locally for development or testing purposes, the quickest way to get started is to use [Vagrant](https://github.com/jembi/openhim-core-js/wiki/Running-the-OpenHIM-using-Vagrant). Alternatively follow the manual install instructions available [here](https://github.com/jembi/openhim-core-js) and [here](https://github.com/jembi/openhim-console).

## Disaster recovery plan

For any production deployment we suggest that you have a disaster recovery plan in place. [Click here](http://www.openhim.org/deploy-the-openhim/disaster-recovery-plan-for-openhim-implementations/ "Click here") is see a guide to get you started putting such a plan in place.