#!/usr/bin/env node

const path = require('path')
const fs = require('fs')

const args = process.argv.slice(2)

/* Check for version flag */
if (args.includes('-v') || args.includes('--version')) {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
  )
  console.log(`OpenHIM Core version ${pkg.version}`)
  process.exit(0)
}

require(path.join(__dirname, '..', 'lib/server.js'))
