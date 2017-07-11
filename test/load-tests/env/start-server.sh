#!/usr/bin/env bash
docker cp ./test/load-tests/env/dump.tar.gz openhim-mongo:/ &&
docker exec -it openhim-mongo bash -c "tar -xzvf dump.tar.gz dump ; mongorestore /dump" &&
echo starting the server
npm run build && mongo_url=mongodb://localhost/openhim-load-test mongo_atnaUrl=mongodb://localhost/openhim-load-test node lib/server.js &