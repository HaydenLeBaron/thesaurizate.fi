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

/**
 * Middleware to check if the authenticated user has admin scope
 */
export function requireAdmin(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): void {
    if (!req.user) {
        res.status(401).json({
            error: 'unauthorized',
            error_description: 'Authentication required',
        });
        return;
    }

    if (!req.user.scopes || !req.user.scopes.includes('admin')) {
        res.status(403).json({
            error: 'forbidden',
            error_description: 'Admin scope required',
        });
        return;
    }

    next();
}
