## Description
Fires up a mongo replica set in docker and runs the OpenHIM tests against the replica set.


## Clean up
```
docker stop replica1 replica2 replica3 replica-core &&
docker rm replica1 replica2 replica3 replica-core
```
