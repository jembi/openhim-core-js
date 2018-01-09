Auditing
========

## ATNA Audit Repository
The OpenHIM provides full support as an Audit Repository actor in the [IHE ATNA profile](http://wiki.ihe.net/index.php?title=Audit_Trail_and_Node_Authentication).

You can make use of this functionality by enabling any of the audit servers in [config](https://github.com/jembi/openhim-core-js/blob/master/config/default.json#L111-L125) before starting up the OpenHIM-core:
```js
"auditing": {
  "servers": {
    "udp": {
      "enabled": true,
      "port": 5050
    },
    "tls": {
      "enabled": true,
      "port": 5051
    },
    "tcp": {
      "enabled": true,
      "port": 5052
    }
  },
  ...
}
```

The OpenHIM supports both RFC3881 and DICOM formatted audit events.

The OpenHIM-console has an audit viewer available on the 'Audit Log' page.

## ATNA Audit Events
The OpenHIM will generate audit events on application start/stop, as well as user authentication. These events can either be sent to the OpenHIM's own internal audit repository, or to an external repository. This can be setup in [config](https://github.com/jembi/openhim-core-js/blob/master/config/default.json#L111-L116) by choosing an appropriate `interface`:
```js
"auditEvents": {
  "interface": "tls",
  "host": "192.168.1.11",
  "port": 8888
}
```

Options for the interface are: `internal`, `udp`, `tls` and `tcp`. The host and port does not need to be set for the `internal` interface.

Note that audit events are generated in RFC3881 format, but see our [RFC3881 to DICOM Mediator](https://github.com/jembi/openhim-mediator-RFC3881toDICOM) for converting to DICOM.
