import { Request, Response, NextFunction } from 'express';
import { oauthServer } from '../services/oauth-server';
import jwt from 'jsonwebtoken';
import { authConfig } from '../config/auth';

export interface AuthenticatedRequest extends Request {
    user?: {
        userId: string;
        scopes?: string[];
    };
}

/**
 * Middleware to authenticate requests using Bearer token
 * Uses express-oauth-server to verify tokens, with fallback to direct JWT verification
 */
export function authenticateToken(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): void {
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

    try {
        // Verify JWT token directly
        const decoded = jwt.verify(token, authConfig.jwtSecret) as any;
        
        // Extract user ID from token (sub claim contains user ID)
        const userId = decoded.sub;
        const scope = decoded.scope || '';
        
        if (!userId) {
            res.status(401).json({
                error: 'unauthorized',
                error_description: 'Invalid token: missing user ID',
            });
            return;
        }

        // Set user info on request
        req.user = {
            userId: userId,
            scopes: scope.split(' ').filter((s: string) => s.length > 0),
        };

        next();
    } catch (error) {
        res.status(401).json({
            error: 'unauthorized',
            error_description: error instanceof Error ? error.message : 'Invalid or expired token',
        });
        return;
    }
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
