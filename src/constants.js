'use strict'

import {config} from './config'

export const DEFAULT_API_PORT = 8080

export const MUTUAL_TLS_AUTH_TYPE = 'mutual-tls-auth'

export const BASIC_AUTH_TYPE = 'basic-auth'

export const CUSTOM_TOKEN_AUTH_TYPE = 'custom-token-auth'

export const JWT_AUTH_TYPE = 'jwt-auth'

export const JWT_PATTERN =
  /^ *(?:[Bb][Ee][Aa][Rr][Ee][Rr]) +([A-Za-z0-9\-._~+/]+=*) *$/

export const CUSTOM_TOKEN_PATTERN =
  /^ *(?:[Cc][Uu][Ss][Tt][Oo][Mm]) +([A-Za-z0-9\-._~+/]+=*) *$/

const OPENHIM_CONSOLE_BASE_URL = config.openhimConsoleBaseUrl || 'http://localhost:9000'

export const DEFAULT_IMPORT_MAP_PATHS = {
  '@jembi/openhim-header':
    `${OPENHIM_CONSOLE_BASE_URL}/jembi-openhim-header.js`,
  '@jembi/legacy-console': `${OPENHIM_CONSOLE_BASE_URL}/bundle.js`,
  '@jembi/openhim-core-api':
  `${OPENHIM_CONSOLE_BASE_URL}/jembi-openhim-core-api.js`,
  '@jembi/openhim-theme':
  `${OPENHIM_CONSOLE_BASE_URL}/jembi-openhim-theme.js`,
  '@jembi/portal-admin':
  `${OPENHIM_CONSOLE_BASE_URL}/jembi-portal-admin.js`,
  '@jembi/openhim-portal':
  `${OPENHIM_CONSOLE_BASE_URL}/jembi-openhim-portal.js`,
  '@jembi/root-config': `${OPENHIM_CONSOLE_BASE_URL}/jembi-root-config.js`,
  '@jembi/openhim-sidebar':
  `${OPENHIM_CONSOLE_BASE_URL}/jembi-openhim-sidebar.js`
}
