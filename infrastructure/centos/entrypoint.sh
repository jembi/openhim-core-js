#!/bin/sh

CORE_VERSION="master"
CONSOLE_VERSION="master"

if [ $# -eq 0 ]
  then
    echo "No arguments supplied. Defaults will be used"
fi

usage()
{
    echo "if this was a real script you would see something useful here"
    echo ""
    echo "Parameters:"
    echo "    -h --help"
    echo "    --core-version=$CORE_VERSION"
    echo "    --console-version=$CONSOLE_VERSION"
    echo ""
}

# https://gist.github.com/jehiah/855086
while [ "$1" != "" ]; do
    PARAM=`echo $1 | awk -F= '{print $1}'`
    VALUE=`echo $1 | awk -F= '{print $2}'`
    case $PARAM in
        -h | --help)
            usage
            exit
            ;;
        --core-version)
            CORE_VERSION=$VALUE
            ;;
        --console-version)
            CONSOLE_VERSION=$VALUE
            ;;
        *)
            echo "ERROR: unknown parameter \"$PARAM\""
            usage
            exit 1
            ;;
    esac
    shift
done

echo "Core version: $CORE_VERSION"
echo "Console version: $CONSOLE_VERSION"

yum -y update
yum install -y git rpm-build redhat-rpm-config gcc-c++ make

# reason for this instead of nvm is that nvm only installs node
curl --silent --location https://rpm.nodesource.com/setup_8.x | bash -
yum install -y nodejs

# Install nvm and nodejs
npm --version && node -v

# Generate openhim-core rpm package
git clone https://github.com/jembi/openhim-core-js.git
cd openhim-core-js/ && git checkout $CORE_VERSION
npm install && npm install speculate && npm run build
# generate SPEC file for rpmbuild
npm run spec
# Link source folder with default rpmbuild
ln -s /openhim-core-js ~/rpmbuild
# Build rpm package
node -v && rpmbuild -bb ~/rpmbuild/SPECS/openhim-core.spec
# copy rpm package to user folder for extraction
cp RPMS/x86_64/*.rpm /usr/packages


# Generate openhim-console rpm package
cd / && rm -rf ~/rpmbuild && git clone https://github.com/jembi/openhim-console.git
cd openhim-console/ && git checkout $CONSOLE_VERSION
npm install && npm install speculate
# generate SPEC file for rpmbuild
npm run spec
# Link source folder with default rpmbuild
ln -s /openhim-console ~/rpmbuild
# Build rpm package
rpmbuild -bb ~/rpmbuild/SPECS/openhim-console.spec
# copy rpm package to user folder for extraction
cp RPMS/x86_64/*.rpm /usr/packages