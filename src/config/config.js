import nconf from 'nconf'
import path from 'path'

export const appRoot = path.resolve(__dirname, '../..')

/*
 * Define the default constructor
 */
function Config () {
  // Get the argument-value to use
  nconf.argv().env('_')
  const environment = nconf.get('NODE:ENV')
  const conf = getConfigOverride(process.argv)

  // Load the configuration-values
  // user specified config override
  if (conf) {
    nconf.file('customConfigOverride', conf)
  }

  // environment override
  if (environment) {
    nconf.file('environmentOverride', `${appRoot}/config/${environment}.json`)
  }

  // load the default config file
  nconf.file('default', `${appRoot}/config/default.json`)

  // Return the result
}

function getConfigOverride (argv) {
  const [conf] = argv.filter(v => /^conf/.test(v))
  if (conf == null) {
    return
  }

  if (/=(.*)/.test(conf)) {
    const [, value] = conf.match(/=(.*)/)
    return value
  }

  const index = argv.indexOf(conf)
  if (argv.length > index + 1) {
    return argv[index + 1]
  }
}

/*
 * This function return the value that was set in the key-value store
 */
Config.prototype.get = key => nconf.get(key)

/*
 * This function constructs a new instanse of this class
 */
export const config = new Config()
