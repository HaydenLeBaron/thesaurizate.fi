import { oauthModel } from '../services/oauth-model';
import { authConfig } from '../config/auth';
import { pool } from '../db';
import * as db from 'zapatos/db';
import jwt from 'jsonwebtoken';

describe('OAuth Model', () => {
  let testUserId: string;

  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE transactions, users RESTART IDENTITY CASCADE');

    const user = await db.insert('users', {
      email: 'test@example.com',
      password_hash: 'hashed_password',
    }).run(pool);
    testUserId = user.id;
  });

  describe('getClient', () => {
    it('should return client for valid credentials', async () => {
      const client = await oauthModel.getClient(
        authConfig.plaidClientId,
        authConfig.plaidClientSecret
      );

      expect(client).not.toBeNull();
      expect(client?.clientId).toBe(authConfig.plaidClientId);
      expect(client?.grants).toContain('client_credentials');
      expect(client?.grants).toContain('authorization_code');
    });

    it('should return null for invalid client ID', async () => {
      const client = await oauthModel.getClient('invalid-client', authConfig.plaidClientSecret);
      expect(client).toBeNull();
    });

    it('should return null for invalid client secret', async () => {
      const client = await oauthModel.getClient(authConfig.plaidClientId, 'invalid-secret');
      expect(client).toBeNull();
    });
  });

  describe('saveToken', () => {
    it('should generate and save access token', async () => {
      const client = await oauthModel.getClient(
        authConfig.plaidClientId,
        authConfig.plaidClientSecret
      );
      expect(client).not.toBeNull();

      const token = await oauthModel.saveToken(
        {
          accessToken: '',
          scope: 'openid accounts',
          client: client!,
        } as any,
        client!,
        { id: testUserId }
      );

      expect(token).toHaveProperty('accessToken');
      expect(token).toHaveProperty('accessTokenExpiresAt');
      expect(token.accessTokenExpiresAt).toBeInstanceOf(Date);

      // Verify token is valid JWT
      const decoded = jwt.verify(token.accessToken, authConfig.jwtSecret) as any;
      expect(decoded.sub).toBe(testUserId);
      expect(decoded.scope).toBe('openid accounts');
      expect(decoded.iss).toBe(authConfig.issuer);
    });

    it('should set correct expiration time', async () => {
      const client = await oauthModel.getClient(
        authConfig.plaidClientId,
        authConfig.plaidClientSecret
      );
      expect(client).not.toBeNull();

      const token = await oauthModel.saveToken(
        {
          accessToken: '',
          scope: 'openid',
          client: client!,
        } as any,
        client!,
        { id: testUserId }
      );

      const now = Date.now();
      const expiresAt = token.accessTokenExpiresAt!.getTime();
      const expectedExpiration = now + authConfig.accessTokenExpiration * 1000;

      // Allow 5 second tolerance
      expect(Math.abs(expiresAt - expectedExpiration)).toBeLessThan(5000);
    });
  });

  describe('getAccessToken', () => {
    it('should retrieve valid access token', async () => {
      // Create a token
      const client = await oauthModel.getClient(
        authConfig.plaidClientId,
        authConfig.plaidClientSecret
      );
      expect(client).not.toBeNull();

      const savedToken = await oauthModel.saveToken(
        {
          accessToken: '',
          scope: 'openid accounts',
          client: client!,
        } as any,
        client!,
        { id: testUserId }
      );

      // Retrieve it
      const retrievedToken = await oauthModel.getAccessToken(savedToken.accessToken);

      expect(retrievedToken).not.toBeNull();
      expect(retrievedToken?.accessToken).toBe(savedToken.accessToken);
      expect(retrievedToken?.user?.id).toBe(testUserId);
      expect(retrievedToken?.scope).toBe('openid accounts');
      expect(retrievedToken?.client).toBeDefined();
    });

    it('should return null for invalid token', async () => {
      const token = await oauthModel.getAccessToken('invalid-token');
      expect(token).toBeNull();
    });

    it('should return null for expired token', async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        {
          sub: testUserId,
          iss: authConfig.issuer,
          aud: 'plaid-core-exchange',
          exp: Math.floor(Date.now() / 1000) - 3600, // Expired
          iat: Math.floor(Date.now() / 1000) - 7200,
          scope: 'openid',
        },
        authConfig.jwtSecret
      );

      const token = await oauthModel.getAccessToken(expiredToken);
      expect(token).toBeNull();
    });
  });

  describe('getUser', () => {
    it('should return user for valid user ID', async () => {
      const user = await oauthModel.getUser(testUserId, 'password');
      expect(user).not.toBeNull();
      expect(user?.id).toBe(testUserId);
      expect(user?.email).toBe('test@example.com');
    });

    it('should return null for non-existent user', async () => {
      const user = await oauthModel.getUser('00000000-0000-0000-0000-000000000000', 'password');
      expect(user).toBeNull();
    });
  });

  describe('saveAuthorizationCode', () => {
    it('should save authorization code', async () => {
      const client = await oauthModel.getClient(
        authConfig.plaidClientId,
        authConfig.plaidClientSecret
      );
      expect(client).not.toBeNull();

      const code = {
        authorizationCode: 'test-code-123',
        expiresAt: new Date(Date.now() + 300 * 1000),
        redirectUri: 'http://localhost:3000/oauth/callback',
        scope: 'openid accounts',
        client: client!,
        user: { id: testUserId },
      };

      const savedCode = await oauthModel.saveAuthorizationCode(code, client!, { id: testUserId });

      expect(savedCode).toHaveProperty('authorizationCode', 'test-code-123');
      expect(savedCode).toHaveProperty('user');
      expect(savedCode.user.id).toBe(testUserId);
    });
  });

  describe('revokeAuthorizationCode', () => {
    it('should revoke authorization code', async () => {
      const client = await oauthModel.getClient(
        authConfig.plaidClientId,
        authConfig.plaidClientSecret
      );
      expect(client).not.toBeNull();

      const code = {
        authorizationCode: 'test-code-123',
        expiresAt: new Date(Date.now() + 300 * 1000),
        redirectUri: 'http://localhost:3000/oauth/callback',
        scope: 'openid accounts',
        client: client!,
        user: { id: testUserId },
      };

      const result = await oauthModel.revokeAuthorizationCode(code);
      expect(result).toBe(true);
    });
  });

  describe('revokeToken', () => {
    it('should revoke token', async () => {
      const client = await oauthModel.getClient(
        authConfig.plaidClientId,
        authConfig.plaidClientSecret
      );
      expect(client).not.toBeNull();

      const token = await oauthModel.saveToken(
        {
          accessToken: '',
          scope: 'openid',
          client: client!,
        } as any,
        client!,
        { id: testUserId }
      );

      const result = await oauthModel.revokeToken(token);
      expect(result).toBe(true);
    });
  });
});

