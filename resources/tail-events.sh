#!/bin/bash

if (( $# < 2)); then
	echo "Tails the OpenHIM events API";
	echo "Usage: $0 USERNAME PASSWORD [https://host:port[/base]]";
	exit 0;
fi

username=$1;
pass=$2;
server=$3;

if [[ -z $server ]]; then
    server="https://localhost:8080"
fi

sync="${server}/heartbeat"
eventsBase="${server}/events"

serverNow=`curl -s $sync | jq -M '.now'`
lastCheck=`node -e 'console.log(Date.now())'`
diff=$(($serverNow - $lastCheck))

while true; do
    events=`./openhim-api-curl.sh $username $pass -s "$eventsBase/$(($lastCheck + $diff))" | jq -M '.events'`
    if [[ "$events" != "[]" ]]; then
        echo $events | jq -C '.[]'
    fi
    lastCheck=`node -e 'console.log(Date.now())'`
    sleep 1
done
