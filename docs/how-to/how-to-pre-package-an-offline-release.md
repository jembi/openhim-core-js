How to pre-package an offline OpenHIM-core release
==================================================

Sometimes it's necessary to install the HIM in a locked down environment, e.g. on a corporate controlled server with a firewall that blocks npm, or in an environment with poor internet access. In these cases it would be useful to prepackage the HIM suitable for installation in such environments. The following instructions detail how to do this using [offline-npm](https://www.npmjs.com/package/offline-npm).

* Install offline-npm: `npm install -g offline-npm`
* Checkout the relevant release of the HIM:
  * `git clone https://github.com/jembi/openhim-core-js.git`
  * `cd openhim-core-js`
  * `git checkout vx.y.z`
* Build the HIM: `npm install`
* Enabled offline-npm: `offline-npm -a`

Next, edit `package.json` and change the line

`"prepublish": "./offline/offline-npm --prepublish ; grunt build",`

removing the `grunt build` command:

`"prepublish": "./offline/offline-npm --prepublish ;",`

(there is an issue with grunt build not working after adding offline-npm)

* Finally create the package: `npm pack`

This should should create a package `openhim-core-x.y.z.tgz`. You can now copy this package onto the server and install it using the command: `npm install -g openhim-core-x.y.z.tgz`.