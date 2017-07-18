#!/usr/bin/env bash
docker run -d -p "40000:27017" --name "openhim-load-mongo" mongo:3.4 &&
docker cp ./test/load-tests/env/dump.tar.gz openhim-load-mongo:/ &&
docker exec -it openhim-load-mongo bash -c "tar -xzvf dump.tar.gz dump ; mongorestore /dump" &&
echo starting the server
npm run build && mongo_url=mongodb://localhost:40000/openhim-load-test mongo_atnaUrl=mongodb://localhost:40000/openhim-load-test node lib/server.js &