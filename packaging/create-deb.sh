#!/bin/bash
# Exit on error
set -e

HOME=`pwd`
AWK=/usr/bin/awk
HEAD=/usr/bin/head
GIT=/usr/bin/git
SORT=/usr/bin/sort
DCH=/usr/bin/dch
PR=/usr/bin/pr
SED=/bin/sed
FMT=/usr/bin/fmt
PR=/usr/bin/pr
XARGS=/usr/bin/xargs
CUT=/usr/bin/cut


cd $HOME/targets
TARGETS=(*)
echo "Targets: $TARGETS"
cd $HOME

PKG=openhim-core-js

echo -n "Which version of the OpenHIM (from NPM) would you like this package to install? (eg. 1.3.0) "
read OPENHIM_VERSION

if [ -z "$OPENHIM_VERSION" ]; then
    echo "Please supply a valid openhim-core version."
    exit 1
fi

echo -n "Would you like to upload the build(s) to Launchpad? [y/N] "
read UPLOAD
if [[ "$UPLOAD" == "y" || "$UPLOAD" == "Y" ]];  then
    if [ -n "$LAUNCHPADPPALOGIN" ]; then
      echo Using $LAUNCHPADPPALOGIN for Launchpad PPA login
      echo "To Change You can do: export LAUNCHPADPPALOGIN=$LAUNCHPADPPALOGIN"
    else
      echo -n "Enter your launchpad login for the ppa and press [ENTER]: "
      read LAUNCHPADPPALOGIN
      echo "You can do: export LAUNCHPADPPALOGIN=$LAUNCHPADPPALOGIN to avoid this step in the future"
    fi

    if [ -n "${DEB_SIGN_KEYID}" ]; then
      echo Using ${DEB_SIGN_KEYID} for Launchpad PPA login
      echo "To Change You can do: export DEB_SIGN_KEYID=${DEB_SIGN_KEYID}"
      echo "For unsigned you can do: export DEB_SIGN_KEYID="
    else
      echo "No DEB_SIGN_KEYID key has been set.  Will create an unsigned"
      echo "To set a key for signing do: export DEB_SIGN_KEYID=<KEYID>"
      echo "Use gpg --list-keys to see the available keys"
    fi

    echo -n "Enter the name of the PPA: "
    read PPA
fi


BUILDDIR=$HOME/builds
echo -n "Clearing out previous builds... "
rm -rf $BUILDDIR
echo "Done."

for TARGET in "${TARGETS[@]}"
do
    TARGETDIR=$HOME/targets/$TARGET
    RLS=`$HEAD -1 $TARGETDIR/debian/changelog | $AWK '{print $2}' | $AWK -F~ '{print $1}' | $AWK -F\( '{print $2}'`
    BUILDNO=$((${RLS##*-}+1))

    if [ -z "$BUILDNO" ]; then
        BUILDNO=1
    fi

    BUILD=${PKG}_${OPENHIM_VERSION}-${BUILDNO}~${TARGET}
    echo "Building $BUILD ..."

    # Update changelog
    cd $TARGETDIR
    echo "Updating changelog for build ..."
    $DCH -Mv "${OPENHIM_VERSION}-${BUILDNO}~${TARGET}" --distribution "${TARGET}" "Release Debian Build ${OPENHIM_VERSION}-${BUILDNO}. Find v${OPENHIM_VERSION} changelog here: https://github.com/jembi/openhim-core-js/releases"

    # Clear and create packaging directory
    PKGDIR=${BUILDDIR}/${BUILD}
    rm -fr $PKGDIR
    mkdir -p $PKGDIR
    cp -R $TARGETDIR/* $PKGDIR

    # Set NPM version of the OpenHIM to install
    $SED -i s/OPENHIM_VERSION=/OPENHIM_VERSION=$OPENHIM_VERSION/ $PKGDIR/home/openhim/bin/install_node.sh
    $SED -i s/OPENHIM_VERSION=/OPENHIM_VERSION=$OPENHIM_VERSION/ $PKGDIR/debian/postinst

    # Install OpenHIM from NPM to get latest files to include in package
    cd /tmp
    TGZ=`npm pack openhim-core@$OPENHIM_VERSION`
    tar xvzf $TGZ
    cd /tmp/package
    npm install --production
    mkdir -p $PKGDIR/usr/share/openhim-core
    mv /tmp/package/* $PKGDIR/usr/share/openhim-core
    rm -r /tmp/package

    cd $PKGDIR
    if [[ "$UPLOAD" == "y" || "$UPLOAD" == "Y" ]] && [[ -n "${DEB_SIGN_KEYID}" && -n "{$LAUNCHPADLOGIN}" ]]; then
        echo "Uploading to PPA ${LAUNCHPADPPALOGIN}/${PPA}"

        CHANGES=${BUILDDIR}/${BUILD}_source.changes

    	DPKGCMD="dpkg-buildpackage -k${DEB_SIGN_KEYID} -S -sa "
    	$DPKGCMD
    	DPUTCMD="dput ppa:$LAUNCHPADPPALOGIN/$PPA $CHANGES"
    	$DPUTCMD
    else
    	echo "Not uploading to launchpad"
    	DPKGCMD="dpkg-buildpackage -uc -us"
    	$DPKGCMD
    fi
done
