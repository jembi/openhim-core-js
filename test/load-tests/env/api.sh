./test/load-tests/env/start-server.sh &&
sleep 7 &&
artillery run -ko artillery/load-api.json test/load-tests/api.yml &&
npm stop &&
artillery report artillery/load-api.json &&
docker stop openhim-load-mongo &&
docker rm openhim-load-mongo