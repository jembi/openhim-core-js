
###
# Send a message to a user using a specific method. Current supported methods are 'email' and 'sms'.
# contactAddress should contain an email address if the method is 'email' and an MSISDN if the method is 'sms'.
#
# The contents of the message should be passed via messagePlain.
# messageHTML is optional and is only used by the 'email' method. 
###
exports.contactUser = contactUser = (method, contactAddress, messagePlain, messageHTML, callback) ->
