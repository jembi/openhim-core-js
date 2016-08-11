#!/bin/bash
# A simple log roller script
#
# Usage:
# Ensure the MAIN_LOG_FILE variable points to your target log file
# Schedule using cron daily, e.g. on Ubuntu:
# sudo crontab -e
# 0 0 * * * /some/location/rotate-log.sh

MAIN_LOG_FILE=/var/log/openhim-core.log

DATE=`date +%Y-%m-%d`
ROLLED_LOG_FILE=`echo $MAIN_LOG_FILE | sed "s/\.log/-$DATE\.log/"`
ROLLED_LOG_FILE_GZ="$ROLLED_LOG_FILE.gz"

if [ ! -f $ROLLED_LOG_FILE_GZ ]; then
    cp $MAIN_LOG_FILE $ROLLED_LOG_FILE;
    gzip $ROLLED_LOG_FILE;
    echo "[rolled over $ROLLED_LOG_FILE_GZ]" > $MAIN_LOG_FILE;
fi
