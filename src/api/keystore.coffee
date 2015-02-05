Keystore = require('../model/keystore').Keystore
Certificate = require('../model/keystore').Certificate
Q = require 'q'
logger = require 'winston'
authorisation = require './authorisation'
pem = require 'pem'

logAndSetResponse = (ctx, status, msg, logLevel) ->
  logger[logLevel] msg
  ctx.body = msg
  ctx.status = status

exports.getServerCert = ->
  # Must be admin
  if authorisation.inGroup('admin', this.authenticated) is false
    logAndSetResponse this, 'forbidden', "User #{this.authenticated.email} is not an admin, API access to getServerCert denied.", 'info'
    return

  try
    keystoreDoc = yield Keystore.findOne().exec()
    this.body = keystoreDoc.cert
  catch err
    logAndSetResponse this, 'internal server error', "Could not fetch the server cert via the API: #{err}", 'error'

exports.getCACerts = ->
  # Must be admin
  if authorisation.inGroup('admin', this.authenticated) is false
    logAndSetResponse this, 'forbidden', "User #{this.authenticated.email} is not an admin, API access to getCACerts denied.", 'info'
    return

  try
    keystoreDoc = yield Keystore.findOne().exec()
    this.body = keystoreDoc.ca
  catch err
    logAndSetResponse this, 'internal server error', "Could not fetch the ca certs trusted by this server via the API: #{err}", 'error'

exports.getCACert = (certId) ->
  # Must be admin
  if authorisation.inGroup('admin', this.authenticated) is false
    logAndSetResponse this, 'forbidden', "User #{this.authenticated.email} is not an admin, API access to getCACert by id denied.", 'info'
    return

  try
    keystoreDoc = yield Keystore.findOne().exec()
    cert = keystoreDoc.ca.id(certId)

    this.body = cert
  catch err
    logAndSetResponse this, 'internal server error', "Could not fetch ca cert by id via the API: #{err}", 'error'


exports.setServerCert = ->
  # Must be admin
  if authorisation.inGroup('admin', this.authenticated) is false
    logAndSetResponse this, 'forbidden', "User #{this.authenticated.email} is not an admin, API access to setServerCert by id denied.", 'info'
    return

  try
    cert = this.request.body.cert
    readCertificateInfo = Q.denodeify pem.readCertificateInfo
    certInfo = yield readCertificateInfo cert
    certInfo.data = cert

    keystoreDoc = yield Keystore.findOne().exec()
    keystoreDoc.cert = certInfo
    yield Q.ninvoke keystoreDoc, 'save'
    this.status = 'created'
  catch err
    logAndSetResponse this, 'internal server error', "Could not add server cert via the API: #{err}", 'error'

exports.getServerKey = ->
  # Must be admin
  if authorisation.inGroup('admin', this.authenticated) is false
    logAndSetResponse this, 'forbidden', "User #{this.authenticated.email} is not an admin, API access to getServerKey by id denied.", 'info'
    return

  try
    key = this.request.body.key
    keystoreDoc = yield Keystore.findOne().exec()
    keystoreDoc.key = key
    yield Q.ninvoke keystoreDoc, 'save'
    this.status = 'created'
  catch err
    logAndSetResponse this, 'internal server error', "Could not add server key via the API: #{err}", 'error'


exports.addTrustedCert = ->
  # Must be admin
  if authorisation.inGroup('admin', this.authenticated) is false
    logAndSetResponse this, 'forbidden', "User #{this.authenticated.email} is not an admin, API access to addTrustedCert by id denied.", 'info'
    return

  try
    chain = this.request.body.cert

    # Parse into an array in case this is a cert chain
    # (code derived from: http://www.benjiegillam.com/2012/06/node-dot-js-ssl-certificate-chain/)
    certs = []
    chain = chain.split "\n"
    cert = []
    for line in chain when line.length isnt 0
      cert.push line
      if line.match /-END CERTIFICATE-/
        certs.push ((cert.join "\n") + "\n")
        cert = []

    keystoreDoc = yield Keystore.findOne().exec()

    for cert in certs
      readCertificateInfo = Q.denodeify pem.readCertificateInfo
      certInfo = yield readCertificateInfo cert
      certInfo.data = cert
      keystoreDoc.ca.push certInfo

    yield Q.ninvoke keystoreDoc, 'save'
    this.status = 'created'
  catch err
    logAndSetResponse this, 'internal server error', "Could not add trusted cert via the API: #{err}", 'error'

exports.removeCACert = (certId) ->
  console.log 'in removeCACert'
  # Must be admin
  if authorisation.inGroup('admin', this.authenticated) is false
    logAndSetResponse this, 'forbidden', "User #{this.authenticated.email} is not an admin, API access to removeCACert by id denied.", 'info'
    return

  try
    keystoreDoc = yield Keystore.findOne().exec()
    keystoreDoc.ca.id(certId).remove()
    yield Q.ninvoke keystoreDoc, 'save'
    this.status = 'ok'
  catch err
    logAndSetResponse this, 'internal server error', "Could not remove ca cert by id via the API: #{err}", 'error'
