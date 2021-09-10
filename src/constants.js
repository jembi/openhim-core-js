'use strict'

export const DEFAULT_API_PORT = 8080

export const MUTUAL_TLS_AUTH_TYPE = 'mutual-tls-auth'

export const BASIC_AUTH_TYPE = 'basic-auth'

export const CUSTOM_TOKEN_AUTH_TYPE = 'custom-token-auth'

export const JWT_AUTH_TYPE = 'jwt-auth'

export const JWT_PATTERN =
  /^ *(?:[Bb][Ee][Aa][Rr][Ee][Rr]) +([A-Za-z0-9\-._~+/]+=*) *$/

export const CUSTOM_TOKEN_PATTERN =
  /^ *(?:[Cc][Uu][Ss][Tt][Oo][Mm]) +([A-Za-z0-9\-._~+/]+=*) *$/
