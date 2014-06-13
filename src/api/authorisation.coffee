Channel = require("../model/channels").Channel
logger = require 'winston'

exports.inGroup = (group, user) ->
	return user.groups.indexOf(group) >= 0

exports.getUserViewableChannels = (user, done) ->

	# if admin allow all channel
	if exports.inGroup 'admin', user
		console.log "User is admin"
		Channel.find {}, (err, channels) ->
			if err
				done err
			done(null, channels)
	else		
		# otherwise figure out what this user can view
		groups = user.groups
		Channel.find { txViewAcl: { $in: user.groups } }, (err, channels) ->
			if err
				done err
			done null, channels

exports.getUserRerunableChannels = (user, done) ->

	# if admin allow all channel
	if exports.inGroup 'admin', user
		Channel.find {}, (err, channels) ->
			if err
				done err
			done null, channels
	else
		# otherwise figure out what this use can rerun
		groups = user.groups
		Channel.find { txRerunAcl: { $in: user.groups } }, (err, channels) ->
			if err
				done err
			done null, channels

