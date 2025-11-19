import { Router, Request, Response } from 'express';
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
router.post('/token', oauthServer.token());

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
