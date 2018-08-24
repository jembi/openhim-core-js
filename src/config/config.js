import nconf from 'nconf'
import path from 'path'
import fs from 'fs'
import logger from 'winston'

export const appRoot = path.resolve(__dirname, '../..')

/*
 * Define the default constructor
 */
function Config () {
  // Get the argument-value to use
  nconf.argv().env('_')

  // don't read NODE:ENV from nconf as it could be overwritten by any env var starting with 'NODE_'
  const environment = process.env.NODE_ENV

  const conf = nconf.get('conf')

  // Load the configuration-values
  // user specified config override
  if (conf) {
    if (!fs.existsSync(conf)) {
      logger.warn(`Invalid config path ${conf}`)
    }
    nconf.file('customConfigOverride', conf)
  }

  // environment override
  if (environment) {
    const envPath = `${appRoot}/config/${environment}.json`
    if (!fs.existsSync(envPath)) {
      logger.warn(`No config found for env ${environment} at path ${envPath}`)
    }
    nconf.file('environmentOverride', `${appRoot}/config/${environment}.json`)
  }

  // load the default config file
  nconf.file('default', `${appRoot}/config/default.json`)

  // Return the result
}

/*
 * This function return the value that was set in the key-value store
 */
Config.prototype.get = key => nconf.get(key)

/*
 * This function constructs a new instanse of this class
 */
export const config = new Config()
