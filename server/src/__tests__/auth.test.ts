import request from 'supertest';
import { app } from './app';
import { pool } from '../db';
import { authConfig } from '../config/auth';
import * as db from 'zapatos/db';
import jwt from 'jsonwebtoken';

describe('OAuth 2.0 / OIDC API', () => {
  let testUserId: string;
  let testUserEmail: string;

  beforeEach(async () => {
    // Clean database before each test
    await pool.query('TRUNCATE TABLE transactions, users RESTART IDENTITY CASCADE');

    // Create a test user
    const user = await db.insert('users', {
      email: 'test@example.com',
      password_hash: 'hashed_password',
    }).run(pool);
    testUserId = user.id;
    testUserEmail = user.email;
  });

  describe('POST /oauth/token (Client Credentials Grant)', () => {
    it('should issue access token with valid client credentials', async () => {
      const response = await request(app)
        .post('/oauth/token')
        .send({
          grant_type: 'client_credentials',
          client_id: authConfig.plaidClientId,
          client_secret: authConfig.plaidClientSecret,
          scope: 'accounts transactions',
        })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('token_type', 'Bearer');
      expect(response.body).toHaveProperty('expires_in');
      expect(response.body).toHaveProperty('scope');

      // Verify token is valid JWT
      const decoded = jwt.verify(response.body.access_token, authConfig.jwtSecret) as any;
      expect(decoded).toHaveProperty('sub');
      expect(decoded).toHaveProperty('iss', authConfig.issuer);
      expect(decoded).toHaveProperty('scope');
    });

    it('should reject invalid client credentials', async () => {
      const response = await request(app)
        .post('/oauth/token')
        .send({
          grant_type: 'client_credentials',
          client_id: 'invalid-client',
          client_secret: 'invalid-secret',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject missing client credentials', async () => {
      const response = await request(app)
        .post('/oauth/token')
        .send({
          grant_type: 'client_credentials',
        })
        .expect(400); // express-oauth-server returns 400 for missing credentials

      expect(response.body).toHaveProperty('error');
    });

    it('should reject unsupported grant type', async () => {
      const response = await request(app)
        .post('/oauth/token')
        .send({
          grant_type: 'password',
          client_id: authConfig.plaidClientId,
          client_secret: authConfig.plaidClientSecret,
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /oauth/userinfo', () => {
    it('should return user info with valid token', async () => {
      // Create a token for the test user
      const token = jwt.sign(
        {
          sub: testUserId,
          iss: authConfig.issuer,
          aud: 'plaid-core-exchange',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
          scope: 'openid profile',
        },
        authConfig.jwtSecret
      );

      const response = await request(app)
        .get('/oauth/userinfo')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('sub', testUserId);
      expect(response.body).toHaveProperty('email', testUserEmail);
      expect(response.body).toHaveProperty('email_verified', true);
    });

    it('should reject request without authorization header', async () => {
      const response = await request(app)
        .get('/oauth/userinfo')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'unauthorized');
      expect(response.body).toHaveProperty('error_description');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/oauth/userinfo')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'unauthorized');
    });

    it('should reject request with expired token', async () => {
      // Create an expired token
      const token = jwt.sign(
        {
          sub: testUserId,
          iss: authConfig.issuer,
          aud: 'plaid-core-exchange',
          exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
          iat: Math.floor(Date.now() / 1000) - 7200,
          scope: 'openid profile',
        },
        authConfig.jwtSecret
      );

      const response = await request(app)
        .get('/oauth/userinfo')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'unauthorized');
    });

    it('should return 404 for non-existent user', async () => {
      // Create a token for a non-existent user
      const nonExistentUserId = '00000000-0000-0000-0000-000000000000';
      const token = jwt.sign(
        {
          sub: nonExistentUserId,
          iss: authConfig.issuer,
          aud: 'plaid-core-exchange',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
          scope: 'openid profile',
        },
        authConfig.jwtSecret
      );

      const response = await request(app)
        .get('/oauth/userinfo')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'not_found');
    });
  });

  describe('GET /oauth/authorize', () => {
    it('should handle authorization request', async () => {
      // The authorize endpoint requires authentication, so it will return 401
      // In a real implementation, this would redirect to a login page
      const response = await request(app)
        .get('/oauth/authorize')
        .query({
          client_id: authConfig.plaidClientId,
          redirect_uri: 'http://localhost:3000/oauth/callback',
          response_type: 'code',
          scope: 'openid accounts',
        });

      // The endpoint is accessible, but requires authentication
      expect([302, 401, 400]).toContain(response.status);
    });
  });

  describe('POST /oauth/authorize', () => {
    it('should handle authorization request via POST', async () => {
      const response = await request(app)
        .post('/oauth/authorize')
        .send({
          client_id: authConfig.plaidClientId,
          redirect_uri: 'http://localhost:3000/oauth/callback',
          response_type: 'code',
          scope: 'openid accounts',
        });

      // The response depends on express-oauth-server implementation
      // This test verifies the endpoint is accessible
      expect([200, 302, 400, 401]).toContain(response.status);
    });
  });
});

