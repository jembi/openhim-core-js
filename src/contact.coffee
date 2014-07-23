logger = require "winston"
nodemailer = require "nodemailer"
config = require "./config/config"
config.nodemailer = config.get('nodemailer')

sendEmail = (contactAddress, title, messagePlain, messageHTML, callback) ->
  smtpTransport = nodemailer.createTransport "SMTP", config.nodemailer

  smtpTransport.sendMail {
			from: config.nodemailer.auth.user
			to: contactAddress
			subject: title
			text: messagePlain
			html: messageHTML
    }, (error, response) ->
			if error
				callback error
			else
				callback null

sendSMS = (contactAddress, message, callback) ->

###
# Send a message to a user using a specific method. Current supported methods are 'email' and 'sms'.
# contactAddress should contain an email address if the method is 'email' and an MSISDN if the method is 'sms'.
#
# The contents of the message should be passed via messagePlain.
# messageHTML is optional and is only used by the 'email' method. 
###
exports.contactUser = contactUser = (method, contactAddress, title, messagePlain, messageHTML, callback) ->
	if method is 'email'
		sendEmail contactAddress, title, messagePlain, messageHTML, callback
	else if method is 'sms'
		sendSMS contactAddress, messagePlain, callback
	else
		callback "Unknown contact method '#{method}'"
