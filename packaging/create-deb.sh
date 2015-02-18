#!/bin/bash
#Exit on error
set -e
set -x

PPA=mhero
CPDIRS=("bin" "config" "infrastructure"  "resources" "src" "tests" "tls")
CPFILES=("coffeelint.json" "Gruntfile.coffee" "LICENSE" "package.json" "README.md")

#Don't edit below

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
echo $TARGETS
cd $HOME





RLSVERS=`$GIT tag -l 'v*' | $SED 's/^v//' | $SORT -rV | $HEAD -1`
PKGVERS=`$GIT tag -l 'ubuntu-*' | $SED 's/^ubuntu-//' | $SORT -rV | $HEAD -1`
PKGRLS=`$GIT tag -l 'ubuntu-*' | $SED 's/^ubuntu-//' | $SED 's/-.*//' | $SORT -rV | $HEAD -1`
if [ -n "$PKGVERS"]  || [ $PKGRLS != $RLSVERS ] ; then
    echo no ubuntu release found
    VERS="$RLSVERS-1"
    LASTVERS="$RLSVERS"
else
    echo have an existing ubuntu release. bumping it
    LASTVERS="ubuntu-$PKGVERS"
    VERS="${RLSVERS}-$((${PKGVERS##*-}+1))"
fi


echo Current ubuntu  verison is $RLSVERS.  Want to create ubuntu release $VERS
$GIT status
echo Should we update changelogs, commit everything under 'packaging'  and tag the release as $VERS? [y/n]
read INCVERS 

echo Should we package only against the formal release v$RLSVERS rather than the latest commit? [y/n]
read FORMAL

if [[ "$INCVERS" == "y" || "$INCVERS" == "Y" ]];  then
    TAG="ubuntu-$VERS"
    COMMITMSG="Release Version $VERS"
    WIDTH=68
    URL=$($GIT config --get remote.origin.url | $SED 's/\.git//' | $SED 's/$/\/commmit\//')




    LOGLINES=$($GIT log --oneline $LASTVERS.. | $HEAD -20 | $AWK '{printf " -%s\n --'$URL'%s\n" , $0, $1}')

    FULLCOMMITMSG=$(echo "$COMMITMSG 
$LOGLINES" |  $XARGS -0 | $AWK '{printf "%-'"$WIDTH.$WIDTH"'s\n" , $0}')


    for TARGET in "${TARGETS[@]}"
    do
	cd $HOME/targets/$TARGET
	$DCH -Mv "${VERS}~$TARGET" --distribution "${TARGET}" "${FULLCOMMITMSG}"
    done
    cd $HOME
    
    $GIT  status

    $GIT add .

    echo "Incrementing version"
    $GIT commit ./ -m "\"${COMMITMSG}\""
    $GIT tag $TAG
elif  [[ "$INCVERS" == "n" || "$INCVERS" == "N" ]];  then
    echo "Not incremementing version"
else
    echo "Don't know what' to do"
    exit 1 
fi




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


BUILD=$HOME/builds


for TARGET in "${TARGETS[@]}"
do
    TARGETDIR=$HOME/targets/$TARGET
    echo "$HEAD -1 $TARGETDIR/debian/changelog | $AWK '{print $2}' | $AWK -F~ '{print $1}' | $AWK -F\( '{print $2}'"
    RLS=`$HEAD -1 $TARGETDIR/debian/changelog | $AWK '{print $2}' | $AWK -F~ '{print $1}' | $AWK -F\( '{print $2}'`
    PKG=`$HEAD -1 $TARGETDIR/debian/changelog | $AWK '{print $1}'`
    PKGDIR=${BUILD}/${PKG}-${RLS}~${TARGET}
    SRCDIR=/tmp/packaging-src/${PKGDIR}
    CHANGES=${BUILD}/${PKG}_${RLS}~${TARGET}_source.changes
    OHDIR=$PKGDIR/home/openhim/$PKG

    echo  "echo Building Package $PKG  on Release $RLS for Target $TARGET"

    rm -fr $PKGDIR
    mkdir -p $OHDIR
    mkdir -p $SRCDIR
    $GIT clone https://github.com/jembi/$PKG.git  $SRCDIR
    cd $SRCDIR 
    if [[ "$FORMAL" == "y" || "$FORMAL" == "Y" ]];  then
	$GIT checkout "v$RLSVERS"
    fi
    for CPDIR in "${CPDIRS[@]}"
    do
	if [ -d "$SRCDIR/$CPDIR" ]; then
	    cp -R $SRCDIR/$CPDIR $OHDIR
	fi
    done
    for CPFILE in "${CPFILES[@]}"
    do
	if [ -f "$SRCDIR/$CPFILE" ]; then
	    cp  $SRCDIR/$CPFILE $OHDIR
	fi
    done
    if [ -d "$SRCDIR/repo" ]; then
	mv $SRCDIR/repo $OHDIR/repo-src 
    fi

    cp  -R $TARGETDIR/* $PKGDIR

    cd $PKGDIR  


    if [[ -n "${DEB_SIGN_KEYID}" && -n "{$LAUNCHPADLOGIN}" ]]; then
	DPKGCMD="dpkg-buildpackage -k${DEB_SIGN_KEYID}  -S -sa "
	$DPKGCMD
	DPUTCMD="dput ppa:$LAUNCHPADPPALOGIN/$PPA  $CHANGES"
	$DPUTCMD
    else
	echo "Not uploading to launchpad"
	DPKGCMD="dpkg-buildpackage -uc -us"
	$DPKGCMD

    fi
done


cd $HOME

git push
git push --tags
