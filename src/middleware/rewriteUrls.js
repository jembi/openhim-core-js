import url from 'url'
import winston from 'winston'
import * as utils from '../utils'
import * as router from '../middleware/router'
import { config } from '../config'
import { promisify } from 'util'

const routerConf = config.get('router')

// see https://regex101.com/r/lW0cN0/1 for an explanation of this regex
const invertPathTransform = pathTransform => pathTransform.replace(/s\/(.*?)\/(.*?)(?:$|\/(.*)$)/, 's/$2/$1/$3')

export function fetchRewriteConfig (channel, authType, callback) {
  // set the user defined rewrite config from current channel
  let rwConfig = []
  if (channel.rewriteUrlsConfig != null) {
    rwConfig = rwConfig.concat(channel.rewriteUrlsConfig)
  }

  if (channel.addAutoRewriteRules) {
    /*
     * Add in default (virtual) rewrite rules for hosts we proxy
     *
     * For example if the SHR for some reason sent back a link to a patient in the CR
     * (using a direct link to the CR), then if we have a channel that points to the
     * CR on a primary route we are able to rewrite the link to point to us instead
     * because we know that host.
     */
    return utils.getAllChannelsInPriorityOrder((err, channels) => {
      if (err != null) {
        return callback(err)
      }

      for (channel of Array.from(channels)) {
        for (const route of Array.from(channel.routes)) {
          if (route.primary) {
            /*
             * if this channel has a pathTranform on its primary route then
             * invert the path transform so that links that point to this route
             * have the path transform reversed when they are rewritten
             *
             * For example, say we have a channel with urlPattern=/CSD/ and a
             * pathTransform on the primary route as follows pathTransform=s/CSD/ihris/
             * (ie. the actual server we are proxying is running on http://<host>:<port>/ihirs/).
             * If we get links back from this server it will be something like
             * http://<host>:<port>/ihirs/something/123 but we need it to be
             * http://<him_host>:<him_port>/CSD/something/123. To do this we can reverse
             * the pathTransform on the route (s/ihris/CSD/) and apply it while doing the
             * rewrite.
             */
            let inverseTransform
            let toPort
            if (route.pathTransform) {
              inverseTransform = invertPathTransform(route.pathTransform)
            }

            // rewrite to the secure port if tls was used for this transaction
            if ((authType != null) === 'tls') {
              toPort = routerConf.httpsPort
            } else {
              toPort = routerConf.httpPort
            }

            // add 'virtual' rewrite config after any user defined config that has been set
            rwConfig.push({
              fromHost: route.host,
              toHost: routerConf.externalHostname,
              fromPort: route.port,
              toPort,
              pathTransform: inverseTransform || null
            })
          }
        }
      }
      return callback(null, rwConfig)
    })
  } else {
    return callback(null, rwConfig)
  }
}

const rewriteUrls = (body, channel, authType, callback) =>
  fetchRewriteConfig(channel, authType, (err, rwConfig) => {
    if (err != null) {
      return callback(err)
    }

    // rewrite each found href, src or fullUrl attribute (in JSON or XML)
    // See https://regex101.com/r/uY3fO1/1 for an explanation of this regex
    const newBody = body.replace(/["|']?(?:href|src|fullUrl)["|']?[:|=]\s?["|'](\S*?)["|']/g, (match, hrefUrl) => {
      let relativePath
      const hrefUrlObj = url.parse(hrefUrl)

      // default to using this channel's host if no host so we can match a rewrite rule
      if ((hrefUrlObj.host == null)) {
        for (const route of Array.from(channel.routes)) {
          if (route.primary) {
            hrefUrlObj.hostname = route.host
            hrefUrlObj.port = route.port.toString()
            relativePath = true
            break
          }
        }
      }

      for (const rewriteRule of Array.from(rwConfig)) {
        // if we find a matching rewrite rule
        if ((rewriteRule.fromHost.toLowerCase() === hrefUrlObj.hostname) && ((rewriteRule.fromPort.toString() === hrefUrlObj.port) || ((rewriteRule.fromPort === 80) && (hrefUrlObj.port === null)))) {
          hrefUrlObj.host = null // so that hostname and port are used separately
          hrefUrlObj.hostname = rewriteRule.toHost
          hrefUrlObj.port = rewriteRule.toPort

          // rewrite protocol depending on the port the rewriteRule uses
          if (hrefUrlObj.protocol) {
            if (rewriteRule.toPort === routerConf.httpsPort) {
              hrefUrlObj.protocol = 'https'
            } else {
              hrefUrlObj.protocol = 'http'
            }
          }

          // if this rewrite rule requires the path to be transformed then do the transform
          if (rewriteRule.pathTransform) {
            hrefUrlObj.pathname = router.transformPath(hrefUrlObj.pathname, rewriteRule.pathTransform)
          }

          // we only run the first matching rule found
          break
        }
      }

      if (relativePath) { // remove the host stuff before formating
        hrefUrlObj.host = null
        hrefUrlObj.hostname = null
        hrefUrlObj.port = null
      }

      // replace the url in the match
      const replacement = url.format(hrefUrlObj)
      winston.debug(`Rewriting url ${hrefUrl} as ${replacement}`)
      return match.replace(hrefUrl, replacement)
    })

    return callback(null, newBody)
  })

if (process.env.NODE_ENV === 'test') {
  exports.invertPathTransform = invertPathTransform
  exports.rewriteUrls = rewriteUrls
}

export async function koaMiddleware (ctx, next) {
  // do nothing to the request
  await next()
  // on response rewrite urls
  if (ctx.authorisedChannel.rewriteUrls) {
    const rewrite = promisify(rewriteUrls)
    ctx.response.body = await rewrite(ctx.response.body.toString(), ctx.authorisedChannel, ctx.authenticationType)
    return winston.info(`Rewrote url in the response of transaction: ${ctx.transactionId}`)
  }
}
