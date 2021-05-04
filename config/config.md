# OpenHIM Config options

The following config option are provided by the OpenHIM. All of these options have default values. You only need to provide config options if they differ from the defaults.

```js
{
  "bindAddress": "0.0.0.0",
  "mongo": {
    // The address of 1 or more mongo servers. If you are using a replicaSet
    // you must specify the '?replicaSet=<name>' option in the url and list
    // all of the hosts in the replica set in a comma separated list.
    // eg. mongodb://localhost:27017,localhost:27018,localhost:27019/openhim?replicaSet=rs0
    "url": "mongodb://localhost/openhim",
    // The mongo address for the ATNA auditing to use, if different from the
    // above.
    "atnaUrl": "mongodb://localhost/openhim"
  },
  "logger": {
    // the logging level
    "level": "info",
    // Whether to store log messages to mongo. Note: if this is disabled the
    // logs API will NOT work!
    "logToDB": true,
    // Whether to cap the size of the log message stored in mongo. This only
    // takes effect if the collection is being created for the first time.
    // i.e. the first time the OpenHIM is run.
    "capDBLogs": true,
    // The max size in bytes of the logs collection
    "capSize": 10000000,
  },
  "router": {
    // The external hostname of the OpenHIM, used to rewrite urls in http responses
    "externalHostname": "localhost"
    // This is the port that the OpenHIM will receive HTTP request on to
    // forward them to other services
    "httpPort": 5001,
    // This is the port that the OpenHIM will receive HTTPS request on to
    // forward  them to other services
    "httpsPort": 5000,
    // The timeout for requests that the OpenHIM makes to other services (in milliseconds)
    "timeout": 60000
  },
  "api": {
    // The port that the OpenHIM API uses
    "port": 8080,
    // The protocol that the OpenHIM API uses
    "protocol": "https",
    // API request are only valid for a particular window once made, this is
    // the size of that window in seconds
    "authWindowSeconds": 10,
    // Max size of a request payload to the API
    "maxPayloadSizeMB": 50,
    // The types of authentication to use for the API
    // Supported types are "token" and "basic"
    "authenicationTypes": ["token"]
  },
  "rerun": {
    // The port that the transaction re-run processor runs on, this port is
    // used internally and SHOULD NOT be exposed past your firewall
    "httpPort": 7786,
    // The host where the re-run processor is running (always the OpenHIM
    // server)
    "host": "localhost",
    "processor": {
      // if the processor is enabled or not
      "enabled": true,
      // The period to poll for new re-run tasks to run
      "pollPeriodMillis": 2000
    }
  },
  "tcpAdapter": {
    "httpReceiver": {
      // the port that the HTTP receiver for TCP transaction runs on. This
      // is an internally used port and SHOULD NOT be exposed past your
      // firewall.
      "httpPort": 7787,
      // The host where the tcp adapter's http receiver is running (always
      // the OpenHIM server)
      "host": "localhost"
    }
  },
  "polling": {
    // the port used by the polling channel processor, this is an internally
    // used port and SHOULD NOT be exposed past your firewall.
    "pollingPort": 7788,
    // The host where the polling processor is running (always the OpenHIM
    // server)
    "host": "localhost"
  },
  "authentication": {
    // What kind of authentication methods to allow
    "enableMutualTLSAuthentication": true,
    "enableBasicAuthentication": true,
    "enableCustomTokenAuthentication": false,
    "enableJWTAuthentication": false,
    // JWT specific config
    "jwt": {
      // The secret or public key used by the encryption algorithm in signing the token
      "secretOrPublicKey": "",
    // The algorithm used to sign the token. i.e. HS256, RS256, ES256, PS256, etc
      "algorithms": "",
    // The JWT Audience (aud) is a registered claim field in the payload.
    // It identifies the intended recipients of the JWT. These values are usually case sensitive strings.
      "audience": "",
    // The JWT Issuer (iss) is a registered claim field in the payload.
    // It identifiers the principal JWT issuer. This value is a case sensitive string.
      "issuer": ""
    }
  },
  "email": {
    // The address to use in the "from" field of the emails
    "fromAddress": "address@example.com",
    "nodemailer": {
      // The nodemailer service to use see: https://github.com/andris9/Nodemailer
      "service": "Gmail",
      "auth": {
        "user": "user@gmail.com",
        "pass": "password"
      }
    }
  },
  "smsGateway": {
    "provider": "clickatell",
    "config": {
      "user": "user",
      "pass": "pass",
      "apiID": "apiID"
    }
  },
  "alerts": {
    // To enable alerting when things go bad
    "enableAlerts": true,
    // How often to poll for alerts
    "pollPeriodMinutes": 1,
    // The name of the OpenHIM instance to use in the alert and report text
    "himInstance": "openhim.jembi.org",
    // The URL of the OpenHIM instance to use for links in the alert and
    // report text
    "consoleURL": "http://openhim.jembi.org"
  },
  "reports": {
    // To enable daily and weekly reporting
    "enableReports": true,
    // To configure the timezone to be used for the Openhim daily and weekly reports.
    // Defaults to server's time. "+0200" for example is the South African timezone.
    "utcOffset": null
  },
  "events": {
    // Should event timestamps be normalized to the transaction time.
    // This will be useful if you have mediators running on other servers
    "enableTSNormalization": true
  },
  "newUserExpiry": {
    // How long to wait before invalidating a user account if they don't
    // login
    "duration": 7,
    "durationType": "days"
  },
  "auditing": {
    // ATNA Audit Repository: Enable or disable the ATNA auditing servers and configure their ports
    "servers": {
      "udp": {
        "enabled": false,
        "port": 5050
      },
      "tls": {
        "enabled": false,
        "port": 5051
      },
      "tcp": {
        "enabled": false,
        "port": 5052
      },
    },
    // ATNA Record Audit Event: Target repository for core to send its own audit events to
    "auditEvents": {
      // Connection type. Options are 'tcp', 'tls', 'udp' or 'internal'
      // If 'internal' then audits will be sent to the HIM's internal audit repository.
      "interface": "internal",
      // Host and port are mandatory for all interfaces except 'internal',
      // in which case the values are ignored
      "host": "localhost",
      "port": 5051
    }
  },
  "caching": {
    // Cache commonly used data for a performance boost
    "enabled": true,
    // How often should the cache be refreshed
    "refreshMillis": 1000
  },
  "tlsClientLookup": {
    // How should client be looked up using TLS. The options are 'strict'
    // where the client's certificate common name must exactly match a
    // client's domain attribute in the OpenHIM and 'in-chain' where as long
    // as there is a client with a domain equal to any certificate in the
    // client's certificate chain they will match.
    "type": "strict"
  },
  "agenda": {
    // How long to wait before starting up the async task processor
    "startupDelay": 500
  },
  "certificateManagement": {
    // Toggle whether to watch the file systems for the server certificate to
    // use or to manage certificates manually. If enables whenever certificate
    // changes are detected then the new certificate is loaded and the server
    // user automatically restarted.
    "watchFSForCert": false,
    // The path to the server certificate (only used if watchFSForCert is enabled)
    "certPath": "/etc/letsencrypt/live/openhim.jembi.org/cert.pem",
    // The path to the server key (only used if watchFSForCert is enabled)
    "keyPath": "/etc/letsencrypt/live/openhim.jembi.org/privkey.pem"
  }
}
```
