node test/load-tests/env/dummy-endpoint-server.js &> /dev/null &&
./test/load-tests/env/start-server.sh &&
sleep 5 &&
artillery run -o artillery/load-clients.json test/load-tests/clients.yml &&
npm stop &&
artillery report artillery/load-clients.json &&
pkill -SIGINT clientLoadTest &&
docker stop openhim-load-mongo &&
docker rm openhim-load-mongo
