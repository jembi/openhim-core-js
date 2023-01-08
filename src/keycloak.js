import Keycloak from 'keycloak-connect'
import {config} from './config'

const { scope, url, realm, clientId, clientSecret } = config.authentication.keycloak

export const keycloak = new Keycloak(
  {
    scope: scope,
  },
  {
    'auth-server-url': url,
    'ssl-required': false,
    realm: realm,
    clientId: clientId,
    secret: clientSecret
  }
)
