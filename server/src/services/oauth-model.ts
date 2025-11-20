import { authConfig } from '../config/auth';
import * as db from 'zapatos/db';
import { pool } from '../db';
import type * as s from 'zapatos/schema';
import jwt from 'jsonwebtoken';

/**
 * OAuth 2.0 model for express-oauth-server
 * Implements the required methods for oauth2-server
 */

export interface OAuthClient {
  id: string;
  clientId: string;
  clientSecret: string;
  grants: string[];
  redirectUris?: string[];
}

export interface OAuthToken {
  accessToken: string;
  accessTokenExpiresAt?: Date;
  refreshToken?: string;
  refreshTokenExpiresAt?: Date;
  scope?: string;
  client: OAuthClient;
  user?: any;
}

export interface OAuthAuthorizationCode {
  authorizationCode: string;
  expiresAt: Date;
  redirectUri: string;
  scope?: string;
  client: OAuthClient;
  user: any;
}

export const oauthModel = {
  /**
   * Get access token
   */
  getAccessToken: async (accessToken: string): Promise<OAuthToken | null> => {
    // In production, store tokens in database
    // For now, we'll verify JWT tokens on the fly
    try {
      const decoded = jwt.verify(accessToken, authConfig.jwtSecret) as any;

      return {
        accessToken,
        accessTokenExpiresAt: new Date(decoded.exp * 1000),
        scope: decoded.scope,
        client: {
          id: 'plaid-client',
          clientId: authConfig.plaidClientId,
          clientSecret: authConfig.plaidClientSecret,
          grants: ['client_credentials', 'authorization_code'],
        },
        user: {
          id: decoded.sub,
        },
      };
    } catch (error) {
      return null;
    }
  },

  /**
   * Get client
   * oauth2-server calls this with both clientId and clientSecret.
   * We should validate both and return null if either doesn't match.
   */
  getClient: async (clientId: string, clientSecret?: string): Promise<OAuthClient | null> => {
    console.log('[getClient] Called with:', { clientId, hasSecret: !!clientSecret, expectedId: authConfig.plaidClientId });

    // If clientId doesn't match, return null
    if (clientId !== authConfig.plaidClientId) {
      console.log('[getClient] ClientId mismatch');
      return null;
    }

    // Validate clientSecret - it must be provided and must match
    if (!clientSecret || clientSecret !== authConfig.plaidClientSecret) {
      console.log('[getClient] ClientSecret mismatch or missing');
      return null;
    }

    // Return client with grants
    const client = {
      id: 'plaid-client',
      clientId: authConfig.plaidClientId,
      clientSecret: authConfig.plaidClientSecret,
      grants: ['client_credentials', 'authorization_code'],
      redirectUris: [process.env.PLAID_REDIRECT_URI || 'http://localhost:3000/oauth/callback'],
    };
    console.log('[getClient] Returning client:', client.id);
    return client;
  },

  /**
   * Save token
   * Generates JWT access token
   */
  saveToken: async (token: OAuthToken, client: OAuthClient, user: any): Promise<OAuthToken> => {
    const now = Math.floor(Date.now() / 1000);

    // Generate JWT access token
    const payload = {
      sub: user?.id || 'service-account',
      iss: authConfig.issuer,
      aud: 'plaid-core-exchange',
      exp: now + authConfig.accessTokenExpiration,
      iat: now,
      scope: token.scope || '',
    };

    const accessToken = jwt.sign(payload, authConfig.jwtSecret);

    return {
      ...token,
      accessToken,
      accessTokenExpiresAt: new Date((now + authConfig.accessTokenExpiration) * 1000),
    };
  },

  /**
   * Get user
   */
  getUser: async (username: string, password: string): Promise<any> => {
    // For client credentials flow, we don't need user lookup
    // For authorization code flow, username would be user ID
    try {
      const user = await db.selectOne('users', { id: username }).run(pool);
      if (!user) {
        return null;
      }
      return {
        id: user.id,
        email: user.email,
      };
    } catch (error) {
      return null;
    }
  },

  /**
   * Get user from client (required for client_credentials grant)
   * For client credentials flow, we return a service account user
   */
  getUserFromClient: async (client: OAuthClient): Promise<any> => {
    console.log('[getUserFromClient] Called with client:', client?.id);
    if (!client) {
      console.log('[getUserFromClient] Client is null!');
      throw new Error('Client is required');
    }
    // For client credentials, return a service account user
    const user = {
      id: 'service-account',
      email: 'service@thesaurum.local',
    };
    console.log('[getUserFromClient] Returning user:', user.id);
    return user;
  },

  /**
   * Get authorization code
   */
  getAuthorizationCode: async (authorizationCode: string): Promise<OAuthAuthorizationCode | null> => {
    // In production, store authorization codes in database
    // For now, simplified implementation
    return null;
  },

  /**
   * Save authorization code
   */
  saveAuthorizationCode: async (
    code: OAuthAuthorizationCode,
    client: OAuthClient,
    user: any
  ): Promise<OAuthAuthorizationCode> => {
    // In production, store authorization codes in database
    return code;
  },

  /**
   * Revoke authorization code
   */
  revokeAuthorizationCode: async (code: OAuthAuthorizationCode): Promise<boolean> => {
    // In production, mark code as revoked in database
    return true;
  },

  /**
   * Revoke token
   */
  revokeToken: async (token: OAuthToken): Promise<boolean> => {
    // In production, mark token as revoked in database
    // For JWT tokens, revocation requires a token blacklist
    return true;
  },

  /**
   * Get refresh token
   */
  getRefreshToken: async (refreshToken: string): Promise<OAuthToken | null> => {
    // Refresh tokens not implemented for now
    return null;
  },
};

