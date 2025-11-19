import { Router, Request, Response } from 'express';
import { authConfig } from '../config/auth';

const router = Router();

/**
 * GET /.well-known/openid-configuration
 * OIDC Discovery endpoint
 */
router.get('/openid-configuration', (req: Request, res: Response) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  res.json({
    issuer: authConfig.issuer,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    userinfo_endpoint: `${baseUrl}/oauth/userinfo`,
    jwks_uri: `${baseUrl}/.well-known/jwks.json`,
    response_types_supported: ['code'],
    grant_types_supported: authConfig.supportedGrantTypes,
    scopes_supported: authConfig.supportedScopes,
    id_token_signing_alg_values_supported: ['HS256'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
  });
});

/**
 * GET /.well-known/jwks.json
 * JWKS endpoint
 * Note: For HS256 (symmetric signing), this is informational only
 */
router.get('/jwks.json', (req: Request, res: Response) => {
  // For HS256 (symmetric), we don't expose the secret
  // In production with RS256, this would return the public key
  res.json({
    keys: [],
  });
});

export default router;
