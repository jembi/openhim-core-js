logger = require 'winston'

exports.inGroup = (group, user) ->
	return user.groups.indexOf('admin') >= 0
