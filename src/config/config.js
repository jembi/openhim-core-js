import nconf from "nconf";
import { path as appRoot } from "app-root-path";

/*
 * Define the default constructor
 */
function Config() {
    // Get the argument-value to use
  nconf.argv().env("_");
  const environment = nconf.get("NODE:ENV") || "development";

    // Load the configuration-values
    // user specified config override
  if (nconf.get("conf")) {
    nconf.file("customConfigOverride", nconf.get("conf"));
  }

    // environment override
  if (environment) {
    nconf.file("environmentOverride", `${appRoot}/config/${environment}.json`);
  }

    // load the default config file
  nconf.file("default", `${appRoot}/config/default.json`);

    // Return the result
}

/*
 * This function return the value that was set in the key-value store
 */
Config.prototype.get = key => nconf.get(key);

/*
 * This function constructs a new instanse of this class
 */
export const config = new Config();
