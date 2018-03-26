How to build a CentOS RPM package
==========================================

The build process for the RPM package is based off of [this](https://github.com/bbc/speculate/wiki/Packaging-a-Node.js-project-as-an-RPM-for-CentOS-7) blog. There is the option to use Vagrant or Docker to build the packages for both the core and console.

The reason for including vagrant is to be able to test the RPM package by running it as a service using SystemCtl - similar to how it will likely be used in a production environment. SystemCtl is not available out the box in docker containers.

Refer to this [blog](https://developers.redhat.com/blog/2014/05/05/running-systemd-within-docker-container/) for a more detailed description of a possible work-around. This is not recommended since it is a hack. This is where vagrant comes in since it sets up an isolated VM.

Using Vagrant
---------------------

1. Setup environment

    Navigate to the infrastructure folder: `infrastructure/centos`

    Provision VM and automatically build RPM package:

    ```bash
    vagrant up
    ```

    > If error free, skip to Step 3

    or without automatic provisioning (useful if you prefer manual control of the process):

    ```bash
    vagrant up --no-provision
    ```

1. [Optional] The Vagrantfile provisions the VM with the latest source code from master and attempts to compile the RPM package for you. However, in the event an error occurs, or if you prefer to have manual control over the process, then you'll need to do the following:

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

1. Install & Test package

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

1. How to check the logs

    ```bash
    sudo systemctl status openhim-core
    sudo tail -f -n 100 /var/log/messages
    ```

1. If everything checks out then extract the RPM package by leaving the VM.

    Install Vagrant scp [plugin](https://github.com/invernizzi/vagrant-scp):
    ```bash
    vagrant plugin install vagrant-scp
    ```

    Then copy the file from the VM:

    ```bash
    vagrant scp default:/home/vagrant/rpmbuild/RPMS/x86_64/{filename}.rpm .
    ```

Using Docker
---------------

1. Setup environment

    Navigate to the infrastructure folder: `infrastructure/centos`

    Build the docker image with centos, ready to build the rpm packages:

    ```bash
    docker build -t rpmbuilder .
    ```

1. Build package

    Note, the RPMBUILD tool for CentOS does not allow special characters in the version name, such as the dash in 'v3.4.0-rc'.

    Run the container and build the rpm packages for latest versions of core & console. This step will build the packages and copy them to the folder specified and automatically remove the docker container.

    ```bash
    docker run -v /folder/for/new/packages/core:/usr/packages --rm rpmbuilder
    ```

    In order to build a package for a specific version of core & console, pass the target versions as parameters as follows:

    ```bash
    docker run -v /folder/for/new/packages/core:/usr/packages --rm rpmbuilder --core-version=v3.4.0 --console-version=v1.11.1
    ```

    Note, the parameters are optional and it is not required to specify a version for either core or console since both will default to the latest code.

1. How to test newly created packages

    Copy the packages to a CentOS system or VM and install them as a service. Alternatively use the vagrant approach as explained earlier.
