import request from 'supertest';
import { app } from './app';
import { authConfig } from '../config/auth';

describe('Well-Known Endpoints', () => {
  describe('GET /.well-known/openid-configuration', () => {
    it('should return OIDC discovery document', async () => {
      const response = await request(app)
        .get('/.well-known/openid-configuration')
        .expect(200);

      expect(response.body).toHaveProperty('issuer', authConfig.issuer);
      expect(response.body).toHaveProperty('authorization_endpoint');
      expect(response.body).toHaveProperty('token_endpoint');
      expect(response.body).toHaveProperty('userinfo_endpoint');
      expect(response.body).toHaveProperty('jwks_uri');
      expect(response.body).toHaveProperty('response_types_supported');
      expect(response.body).toHaveProperty('grant_types_supported');
      expect(response.body).toHaveProperty('scopes_supported');
      expect(response.body).toHaveProperty('id_token_signing_alg_values_supported');
      expect(response.body).toHaveProperty('token_endpoint_auth_methods_supported');

      // Verify endpoints are correct
      expect(response.body.authorization_endpoint).toContain('/oauth/authorize');
      expect(response.body.token_endpoint).toContain('/oauth/token');
      expect(response.body.userinfo_endpoint).toContain('/oauth/userinfo');
      expect(response.body.jwks_uri).toContain('/.well-known/jwks.json');

      // Verify supported values
      expect(response.body.grant_types_supported).toContain('client_credentials');
      expect(response.body.grant_types_supported).toContain('authorization_code');
      expect(response.body.scopes_supported).toContain('openid');
      expect(response.body.scopes_supported).toContain('accounts');
      expect(response.body.scopes_supported).toContain('transactions');
    });

    it('should use correct base URL from request', async () => {
      const response = await request(app)
        .get('/.well-known/openid-configuration')
        .set('Host', 'example.com')
        .expect(200);

      // The issuer should match the configured issuer, not the request host
      expect(response.body.issuer).toBe(authConfig.issuer);
    });
  });

  describe('GET /.well-known/jwks.json', () => {
    it('should return JWKS document', async () => {
      const response = await request(app)
        .get('/.well-known/jwks.json')
        .expect(200);

      expect(response.body).toHaveProperty('keys');
      expect(Array.isArray(response.body.keys)).toBe(true);

      // For HS256 (symmetric signing), keys array may be empty
      // This is expected behavior as we don't expose the secret
    });

    it('should be accessible without authentication', async () => {
      const response = await request(app)
        .get('/.well-known/jwks.json')
        .expect(200);

      expect(response.body).toHaveProperty('keys');
    });
  });
});

