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

package { "libkrb5-dev":
    ensure => "installed",
}

package { "git":
    ensure => "installed",
}

package { "vim":
    ensure => "installed",
}


# Node

class { "nodejs":
    version => "v4.3.0",
    make_install => false,
}


exec { "npm-install":
    cwd => "/openhim-core-js",
    timeout => 0,
    command => "npm install",
    require => [ Class["nodejs"], Package["build-essential"], Package["git"] ],
}

exec { "install-grunt":
    command => "npm install -g grunt-cli",
    timeout => 0,
    unless => "npm list -g grunt-cli",
    require => Class["nodejs"],
}
