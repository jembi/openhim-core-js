'use strict'

export function setupProxyHeaders(ctx) {
  function setOrAppendHeader(ctx, header, value) {
    if (!value) {
      return
    }
    if (ctx.header[header]) {
      ctx.header[header] = `${ctx.header[header]}, ${value}`
    } else {
      ctx.header[header] = `${value}`
    }
  }

  setOrAppendHeader(ctx, 'X-Forwarded-For', ctx.request.ip)
  return setOrAppendHeader(ctx, 'X-Forwarded-Host', ctx.request.host)
}

export async function koaMiddleware(ctx, next) {
  exports.setupProxyHeaders(ctx)
  await next()
}
