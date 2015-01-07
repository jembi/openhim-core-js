# Puppet manifest
#
# Required modules:
# willdurand/nodejs
# puppetlabs/mongodb
#

# Set home and change source_dir to the openhim-core-js source location
$home="/root"
$source_dir="$home/openhim-core-js"
$node_env="production"
$node_bin="/usr/local/node/node-v0.11.11/bin"
$node_exec="$node_bin/node"
$npm_exec="$node_bin/npm"

# defaults for Exec
Exec {
	path => ["/bin", "/sbin", "/usr/bin", "/usr/sbin", "/usr/local/bin", "/usr/local/sbin", "/usr/local/node/node-default/bin/"],
	user => "root",
}

package { "git":
	ensure => "installed",
}

package { "build-essential":
	ensure => "installed",
}

if $environment != 'deployment' {
    class { "mongodb::globals":
        manage_package_repo => true
    }

    class { "mongodb":
        init => "upstart",
    }
}

class { "nodejs":
	version => "stable",
}

nodejs::install { "node-v0.11.11":
	version => "v0.11.11",
}

exec { "npm-install":
	cwd => "$source_dir",
	command => "$npm_exec install",
	require => [ Nodejs::Install["node-v0.11.11"], Package["build-essential"] ],
}

exec { "install-grunt":
	cwd => "$source_dir",
	command => "npm install -g grunt-cli",
	unless => "npm list -g grunt-cli",
	require => Nodejs::Install["node-v0.11.11"],
}

exec { "build":
	cwd => "$source_dir",
	command => "grunt build",
	require => [ Exec["install-grunt"], Exec["npm-install"] ],
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

file { "${home}/deploy-openhim-core.sh":
	ensure  => file,
	mode    => 770,
	content => template("$source_dir/infrastructure/deployment/update/deploy.sh"),
}
