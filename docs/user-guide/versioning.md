OpenHIM Core versioning and compatibility
=========================================

The [OpenHIM Core component](https://github.com/jembi/openhim-core-js) uses [Semantic Versioning](http://semver.org/). This means that if a specific software component, such as the OpenHIM Console or a Mediator states that it is compatible with Core version 1.2 for example, it means that:
* At a minimum the component is compatible with Core version 1.2 but is NOT guaranteed to work with a lower version of Core such 1.1
* The component WILL be compatible with any patch version in its release range, such as Core 1.2.1 or Core 1.2.2, even if the component was developed against a higher patch number such as 1.2.3
* WILL be compatible with Core 1.x, such as version 1.3 or 1.4, since these versions are backwards compatible with lower versions
* The software component is NOT guaranteed to work with Core 2.0 or higher, however this doesn’t preclude the possibility that it CAN work.
