# Puppet manifest
#
# Required modules:
# willdurand/nodejs
# puppetlabs/mongodb
#

# Set home and change source_dir to the openhim-core-js source location
$home="/home/vagrant"
$source_dir="/openhim-core-js"
$node_env="production"
$node_exec="/usr/local/node/node-default/bin/node"

# defaults for Exec
Exec {
	path => ["/bin", "/sbin", "/usr/bin", "/usr/sbin", "/usr/local/bin", "/usr/local/sbin", "/usr/local/node/node-default/bin/"],
	user => "root",
}

package { "git":
	ensure => "installed",
}

class { "mongodb::globals":
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
	require => Class["nodejs"],
}

exec { "coffeescript":
	command => "npm install -g coffee-script",
	require => Class["nodejs"],
}

exec { "build":
	cwd => "$source_dir",
	command => "cake build",
	require => [ Exec["coffeescript"], Exec["npm-install"] ],
	notify => Service["openhim-core-js"],
}

file { "/etc/init/openhim-core-js.conf":
	ensure  => file,
	content => template("$source_dir/infrastructure/deployment/env/upstart.erb"),
}

service { "openhim-core-js":
	ensure => "running",
	enable => true,
	require => [ Exec["npm-install"], Exec["build"], File["/etc/init/openhim-core-js.conf"] ],
}

file { "${home}/deploy.sh":
	ensure  => file,
	content => template("$source_dir/infrastructure/deployment/update/deploy.sh"),
}