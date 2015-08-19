Sample disaster recovery procedure
==================================

This page describes a suggested disaster recover plan for an OpenHIM deployment. We suggest you follow this as a minimum for an production deploymnet of the OpenHIM.

## Prior to disaster

The OpenHIM can be configured fairly simply to allow for disaster recovery. The only artefacts that need to be protected are the mongodb databases (main and the audit db) that the OpenHIM uses and the OpenHIM config file(s) that are used.

*   For each mongo database you should use a geographically distributed replica set for redundancy. See [here for more details](http://docs.mongodb.org/manual/tutorial/deploy-geographically-distributed-replica-set/). A 3 node set is suggested with 2 nodes in your primary data center and 1 node in a geographically distant location.
*   The OpenHIM config file(s) should also be backed up. These should be periodically rsync’d to a geographically distant location (this can be on the same instance that your distant mongodb node is located).

A resource should also be created that describes the location of where the backup data is stored and contains the details of servers and procedure put in place through using this guide.

### Security and firewalling

To secure the OpenHIM we suggest only allowing access to the specific port needed for the application to run. The following must be exposed, all others should be restricted.

*   OpenHIM API port (default: 8080)
*   OpenHIM non-secure transaction port (default: 5001)
*   OpenHIM secure transaction port (default: 5000)
*   Any TCP ports you have specified in the OpenHIM UI

We also suggest that the mongodb replica sets all be hosted on instances separate from the OpenHIM application with only the follow port allowed through the firewall:

*   The mongodb port (default: 27017)

We  also suggest that these instances block access from all other IPs other than the instance that the OpenHIM-core server is hosted on.

## During a disaster

1.  Ensure that a new primary mongodb node is elected if mongo was the failure
2.  Ensure that the application remains operable.
3.  Attempt to bring up the failed system. If this is a mongodb node ensure that is rejoins the replica set.

## After the disaster

1.  Ensure that no data was lost.
2.  Identify root cause of the problem.
3.  Attempt to mitigate the root cause of the problem.

## Disaster Scenario Test

A schedule should be set up that outlines when the disaster recovery process is tested. Ideally the test scenario should be executed greater than zero times per project.