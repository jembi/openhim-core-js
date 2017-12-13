How to run the OpenHIM using vagrant
====================================

If you're a developer, or would just like to get the OpenHIM up and running for testing purposes, the quickest way to do so is to fire up a Vagrant instance.

Steps
-----

* Setup [Vagrant](https://www.vagrantup.com/) on your system. Note that you'll also have to install [VirtualBox](https://www.virtualbox.org/).
* Clone the repo
 * (if necessary) `sudo apt-get install git`
 * `git clone https://github.com/jembi/openhim-core-js.git`
* Launch the instance
 * `cd openhim-core-js/infrastructure/deployment/env`
 * `vagrant up`

And that's it! Your Vagrant instance should now be up and running. You can access it by running the command `vagrant ssh`. The OpenHIM itself will be available in the `/openhim-core-js` directory. You can proceed as follows in order to run it:
```
vagrant ssh
> cd /openhim-core-js
> grunt build
> node --harmony lib/server.js
```

If you would like to run the console as well, the easiest way is to fire up another vagrant instance [in another terminal]:
```
git clone https://github.com/jembi/openhim-console.git
cd openhim-console/infrastructure/deployment/env
vagrant up
vagrant ssh
> cd /openhim-console
> grunt serve
```

Note that the vagrant instances have port forwarding enabled, so to access the console you can do so by just navigating to **http://localhost:9000** in your browser on the system that's running the vagrant instance, not the instance itself (which you would struggle to do anyway!).

When you're done you can dispose of an instance by running `vagrant destroy` (not ssh'd into the vagrant instance).