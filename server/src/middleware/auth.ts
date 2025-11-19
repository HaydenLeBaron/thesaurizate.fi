import { Request, Response, NextFunction } from 'express';
import { oauthServer } from '../services/oauth-server';

export interface AuthenticatedRequest extends Request {
    user?: {
        userId: string;
        scopes?: string[];
    };
}

/**
 * Middleware to authenticate requests using Bearer token
 * Uses express-oauth-server to verify tokens
 */
export function authenticateToken(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): void {
    // Use oauthServer.authenticate() middleware
    oauthServer.authenticate()(req, res, (err?: any) => {
        if (err) {
            res.status(401).json({
                error: 'unauthorized',
                error_description: err.message || 'Invalid or expired token',
            });
            return;
        }

        // Extract user info from oauth token
        if ((req as any).oauth?.token) {
            const token = (req as any).oauth.token;
            req.user = {
                userId: token.user?.id || token.userId || '',
                scopes: token.scope?.split(' ') || [],
            };
        }

        next();
    });
}
