import { Router, Request, Response, NextFunction } from 'express';
import { oauthServer } from '../services/oauth-server';
import { authConfig } from '../config/auth';
import * as db from 'zapatos/db';
import { pool } from '../db';
import jwt from 'jsonwebtoken';

const router = Router();

/**
 * POST /oauth/token
 * OAuth 2.0 token endpoint
 * Uses express-oauth-server to handle token requests
 */
router.post('/token', (req, res, next) => {
  console.log('[OAuth Token] Request body:', req.body);
  oauthServer.token()(req, res, (err: any) => {
    if (err) {
      console.error('[OAuth Token] Error:', err.name, err.message, err);
      // Handle OAuth errors
      if (err.name === 'invalid_client' || err.name === 'unauthorized_client') {
        return res.status(401).json({
          error: err.name || 'invalid_client',
          error_description: err.message,
        });
      }
      if (err.name === 'invalid_request' || err.name === 'invalid_grant') {
        return res.status(400).json({
          error: err.name || 'invalid_request',
          error_description: err.message,
        });
      }
      // Unknown error - log it
      console.error('[OAuth Token] Unknown error:', err);
      return res.status(err.status || 500).json({
        error: 'server_error',
        error_description: err.message,
      });
    }
    // Success - response already sent by express-oauth-server
  });
});

/**
 * POST /oauth/authorize
 * OAuth 2.0 authorization endpoint
 */
router.post('/authorize', oauthServer.authorize());

/**
 * GET /oauth/authorize
 * OAuth 2.0 authorization endpoint (GET)
 */
router.get('/authorize', oauthServer.authorize());

/**
 * GET /oauth/userinfo
 * OIDC UserInfo endpoint
 */
router.get('/userinfo', async (req: Request, res: Response) => {
    try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                error: 'unauthorized',
                error_description: 'Missing authorization header',
            });
            return;
        }

        const token = authHeader.substring(7);

        // Verify token
        const decoded = jwt.verify(token, authConfig.jwtSecret) as any;
        const userId = decoded.sub;

        // Handle service account (client credentials flow)
        if (userId === 'service-account') {
            res.json({
                sub: 'service-account',
                email: 'service@thesaurum.local',
                email_verified: true,
                name: 'Service Account',
            });
            return;
        }

        // Get user info
        const user = await db.selectOne('users', { id: userId }).run(pool);
        if (!user) {
            res.status(404).json({
                error: 'not_found',
                error_description: 'User not found',
            });
            return;
        }

        res.json({
            sub: user.id,
            email: user.email,
            email_verified: true,
            name: (user as any).account_name || user.email,
        });
    } catch (error) {
        console.error('Error in userinfo endpoint:', error);
        res.status(401).json({
            error: 'unauthorized',
            error_description: 'Invalid or expired token',
        });
    }
});

export default router;
