logger = require "winston"
nodemailer = require "nodemailer"
request = require "request"
config = require "./config/config"
config.nodemailer = config.get('nodemailer')
config.smsGateway = config.get('smsGateway')

sendEmail = (contactAddress, title, messagePlain, messageHTML, callback) ->
  smtpTransport = nodemailer.createTransport "SMTP", config.nodemailer

  smtpTransport.sendMail {
			from: config.nodemailer.auth.user
			to: contactAddress
			subject: title
			text: messagePlain
			html: messageHTML
    }, (error, response) ->
			callback err ? null

sendSMS = (contactAddress, message, callback) ->
	if config.smsGateway.provider is 'clickatell'
		sendSMS_Clickatell contactAddress, message, callback
	else
		callback "Unknown SMS gateway provider '#{config.smsGateway.provider}'"

sendSMS_Clickatell = (contactAddress, message, callback) ->
	request "http://api.clickatell.com/http/sendmsg?api_id=#{config.smsGateway.config.apiID}&" +
		"user=#{config.smsGateway.config.user}&password=#{config.smsGateway.config.pass}&" +
		"to=#{contactAddress}&text=#{escapeSpaces message}", (err, response, body) ->
		logger.info "Received response from Clickatell: #{body}" if body?
		callback err ? null


escapeSpaces = (str) -> str.replace ' ', '+'

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
