url = require 'url'
winston = require 'winston'
Q = require 'q'

Channel = (require '../../lib/model/channels').Channel
config = require '../config/config'
routerConf = config.get 'router'
utils = require '../../lib/utils'
router = require '../../lib/middleware/router'

invertPathTransform = (pathTransform) ->
  # see https://regex101.com/r/lW0cN0/1 for an explanation of this regex
  return pathTransform.replace /s\/(.*?)\/(.*?)(?:$|\/(.*)$)/, 's/$2/$1/$3'

exports.fetchRewriteConfig = (channel, authType, callback) ->
  # set the user defined rewrite config from current channel
  rwConfig = []
  if channel.rewriteUrlsConfig?
    rwConfig = rwConfig.concat channel.rewriteUrlsConfig

  if channel.addAutoRewriteRules
    ###
    # Add in default (virtual) rewrite rules for hosts we proxy
    #
    # For example if the SHR for some reason sent back a link to a patient in the CR
    # (using a direct link to the CR), then if we have a channel that points to the
    # CR on a primary route we are able to rewrite the link to point to us instead
    # because we know that host.
    ###
    utils.getAllChannels (err, channels) ->
      if err?
        return callback err

      for channel in channels
        for route in channel.routes
          do ->
            if route.primary
              ###
              # if this channel has a pathTranform on its primary route then
              # invert the path transform so that links that point to this route
              # have the path transform reversed when they are rewritten
              #
              # For example, say we have a channel with urlPattern=/CSD/ and a
              # pathTransform on the primary route as follows pathTransform=s/CSD/ihris/
              # (ie. the actual server we are proxying is running on http://<host>:<port>/ihirs/).
              # If we get links back from this server it will be something like
              # http://<host>:<port>/ihirs/something/123 but we need it to be
              # http://<him_host>:<him_port>/CSD/something/123. To do this we can reverse
              # the pathTransform on the route (s/ihris/CSD/) and apply it while doing the
              # rewrite.
              ###
              if route.pathTransform
                inverseTransform = invertPathTransform route.pathTransform

              # rewrite to the secure port if tls was used for this transaction
              if authType? is 'tls'
                toPort = routerConf.httpsPort
              else
                toPort = routerConf.httpPort

              # add 'virtual' rewrite config after any user defined config that has been set
              rwConfig.push
                'fromHost':       route.host
                'toHost':         routerConf.externalHostname
                'fromPort':       route.port
                'toPort':         toPort
                'pathTransform':  if inverseTransform then inverseTransform else null

      callback null, rwConfig
  else
    callback null, rwConfig

rewriteUrls = (body, channel, authType, callback) ->
  exports.fetchRewriteConfig channel, authType, (err, rwConfig) ->
    if err?
      return callback err

    # rewrite each found href or src attribute (in JSON or XML)
    # See https://regex101.com/r/uY3fO1/1 for an explanation of this regex
    newBody = body.replace /["|']?(?:href|src)["|']?[:|=]\s?["|'](\S*?)["|']/g, (match, hrefUrl) ->
      hrefUrlObj = url.parse hrefUrl

      # default to using this channel's host if no host so we can match a rewrite rule
      if not hrefUrlObj.host?
        for route in channel.routes
          if route.primary
            hrefUrlObj.hostname = route.host
            hrefUrlObj.port = route.port.toString()
            relativePath = true
            break

      for rewriteRule in rwConfig
        # if we find a matching rewrite rule
        if rewriteRule.fromHost.toLowerCase() is hrefUrlObj.hostname and (rewriteRule.fromPort.toString() is hrefUrlObj.port or (rewriteRule.fromPort is 80 and hrefUrlObj.port is null))
          hrefUrlObj.host = null # so that hostname and port are used separately
          hrefUrlObj.hostname = rewriteRule.toHost
          hrefUrlObj.port = rewriteRule.toPort

          # rewrite protocol depending on the port the rewriteRule uses
          if hrefUrlObj.protocol
            if rewriteRule.toPort is routerConf.httpsPort
              hrefUrlObj.protocol = 'https'
            else
              hrefUrlObj.protocol = 'http'

          # if this rewrite rule requires the path to be transformed then do the transform
          if rewriteRule.pathTransform
            hrefUrlObj.pathname = router.transformPath hrefUrlObj.pathname, rewriteRule.pathTransform

          # we only run the first matching rule found
          break

      if relativePath # remove the host stuff before formating
        hrefUrlObj.host = null
        hrefUrlObj.hostname = null
        hrefUrlObj.port = null

      # replace the url in the match
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
