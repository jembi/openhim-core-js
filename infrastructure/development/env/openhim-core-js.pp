# Puppet manifest
#
# Required modules:
# willdurand/nodejs
# puppetlabs/mongodb
#

# defaults for Exec
Exec {
	path => ["/bin", "/sbin", "/usr/bin", "/usr/sbin", "/usr/local/bin", "/usr/local/sbin", "/usr/local/node/node-default/bin/"],
	user => "root",
}

package { "build-essential":
	ensure => "installed",
}

class { 'mongodb::globals':
	manage_package_repo => true
}

class { "mongodb":
	init => "upstart",
}

class { "nodejs":
	version => "latest",
}

exec { "npm-install":
	cwd => "/openhim-core-js",
	command => "npm install",
	require => [ Class["nodejs"], Package["build-essential"] ],
}

exec { "coffeescript":
	command => "npm install -g coffee-script",
	unless => "npm list -g coffee-script",
	require => Class["nodejs"],
}
