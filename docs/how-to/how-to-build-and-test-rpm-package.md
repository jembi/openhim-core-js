How to build and test a CentOS RPM package
==========================================

The build process for the RPM package is based off [this](https://github.com/bbc/speculate/wiki/Packaging-a-Node.js-project-as-an-RPM-for-CentOS-7) blog. The reason for using vagrant instead of docker is so that we can test the RPM package by running it as a service using SystemCtl - similar to how it will likely be used in a production environment. SystemCtl is not available out the box in docker containers.

Refer to this [blog](https://developers.redhat.com/blog/2014/05/05/running-systemd-within-docker-container/) for a more detailed description of a possible work-around. This is not recommended since it is a hack. This is where vagrant comes in since it sets up an isolated VM.

1. Setup environment

Navigate to the infrastructure folder: `infrastructure/centos`

Provision VM and automatically build RPM package:
```bash
vagrant up
```
or without automatic provisioning (useful if you prefer manual control of the process):
```bash
vagrant up --no-provision
```

2. [Optional] The Vagrantfile provisions the VM with the latest source code from master and attempts to compile the RPM package for you. However in the event an error occurs, or if you prefer to have manual control over the process, then you'll need to do the following:

* Remote into the VM: `vagrant ssh`
* Download or sync all source code into VM.
* Ensure all dependencies are installed.
```bash
npm i && npm i speculate
```
* Run speculate to generate the SPEC files needed to build the RPM package.
```bash
npm run spec
```
* Ensure the directory with the source code is linked to the rpmbuild directory - the folder RPMBUILD will use.
```bash
ln -s ~/openhim-core ~/rpmbuild
```
* Build RPM package.
```bash
rpmbuild -bb ~/rpmbuild/SPECS/openhim-core.spec
```

3. Install & Test package

```bash
sudo yum install -y ~/rpmbuild/RPMS/x86_64/openhim-core-{current_version}.x86_64.rpm
sudo systemctl start openhim-core
curl https://localhost:8080/heartbeat -k
```

Note: In order for openhim-core to run successfully, you'll need to point it to a valid instance of Mongo or install it locally:

```bash
sudo yum install mongodb-org
sudo service mongod start
```

4. How to check the logs?

```bash
sudo systemctl status openhim-core
sudo tail -f -n 100 /var/log/messages
```

5. If everything checks out then extract the RPM package by leaving the VM.

Install Vagrant scp [plugin](https://github.com/invernizzi/vagrant-scp):
```bash
vagrant plugin install vagrant-scp
```

Then copy the file from the VM:

```bash
vagrant scp default:/home/vagrant/rpmbuild/RPMS/x86_64/{filename}.rpm .
```