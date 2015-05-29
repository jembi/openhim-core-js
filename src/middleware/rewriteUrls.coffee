url = require 'url'
winston = require 'winston'
Q = require 'q'

Channel = (require '../../lib/model/channels').Channel
config = require '../config/config'
routerConf = config.get 'router'
utils = require '../../lib/utils'
router = require '../../lib/middleware/router'

invertPathTransform = (pathTransform) ->
  return pathTransform.replace /s\/(.*?)\/(.*?)($|\/(.*)$)/, 's/$2/$1/$4'

exports.fetchRewriteConfig = (channel, authType, callback) ->
  # set rewrite config from current channel
  rwConfig = []
  if channel.rewriteUrlsConfig?
    rwConfig = channel.rewriteUrlsConfig

  # add in default rewrite rules for hosts we proxy
  utils.getAllChannels (err, channels) ->
    if err?
      return callback err

    for channel in channels
      for route in channel.routes
        do ->
          if route.primary
            if route.pathTransform
              inverveTransform = invertPathTransform route.pathTransform

            if authType? is 'tls'
              toPort = routerConf.httpsPort
            else
              toPort = routerConf.httpPort

            rwConfig.push
              'fromHost':       route.host
              'toHost':         routerConf.externalHostname
              'fromPort':       route.port
              'toPort':         toPort
              'pathTransform':  if inverveTransform then inverveTransform else null

    callback null, rwConfig

rewriteUrls = (body, channel, authType, callback) ->
  exports.fetchRewriteConfig channel, authType, (err, rwConfig) ->
    if err?
      return callback err

    # rewrite each found href attribute (in JSON or XML)
    newBody = body.replace /["|']?href["|']?[:|=]\s?["|'](\S*?)["|']/g, (match, hrefUrl) ->
      hrefUrlObj = url.parse hrefUrl

      # default to using this channel's host if no host
      if not hrefUrlObj.host?
        for route in channel.routes
          if route.primary
            hrefUrlObj.hostname = route.host
            relativePath = true
            break

      for rewriteRule in rwConfig
        # if we find a matching rewrite rule
        if rewriteRule.fromHost.toLowerCase() is hrefUrlObj.hostname and (rewriteRule.fromPort.toString() is hrefUrlObj.port or (rewriteRule.fromPort is 80 and hrefUrlObj.port is null))
          hrefUrlObj.host = null # so that hostname and port are used separately
          hrefUrlObj.hostname = rewriteRule.toHost
          hrefUrlObj.port = rewriteRule.toPort

          if hrefUrlObj.protocol
            if rewriteRule.toPort is routerConf.httpsPort
              hrefUrlObj.protocol = 'https'
            else
              hrefUrlObj.protocol = 'http'

          if rewriteRule.pathTransform
            hrefUrlObj.pathname = router.transformPath hrefUrlObj.pathname, rewriteRule.pathTransform

          # we only run the first matching rule
          break

      if relativePath # remove the host stuff before formating
        hrefUrlObj.host = null
        hrefUrlObj.hostname = null
        hrefUrlObj.port = null

      replacement = url.format hrefUrlObj
      winston.debug "Rewriting url #{hrefUrl} as #{replacement}"
      return match.replace hrefUrl, replacement

    callback null, newBody

if process.env.NODE_ENV is 'test'
  exports.invertPathTransform = invertPathTransform
  exports.rewriteUrls = rewriteUrls

exports.koaMiddleware = (next) ->
  # do nothing to the request
  yield next
  # on response rewrite urls
  if this.authorisedChannel.rewriteUrls
    rewrite = Q.denodeify rewriteUrls
    this.response.body =  yield rewrite this.response.body.toString(), this.authorisedChannel, this.authenticationType
    winston.info "Rewrote url in the response of transaction: #{this.transactionId}"
