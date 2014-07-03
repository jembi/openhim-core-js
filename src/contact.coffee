
###
# Send a message to a user using a specific method. Current supported methods are 'email' and 'sms'.
#
# The contents of the message should be passed via messagePlain.
# messageHTML is optional and is only used by the 'email' method. 
###
exports.contactUser = contactUser = (user, method, messagePlain, messageHTML, callback) ->

###
# Sends a message to a contact group. See #contactUser
###
exports.contactGroup = (group, messagePlain, messageHTML, callback) ->
