import { Request, Response, NextFunction } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { authConfig } from '../config/auth';
import jwt from 'jsonwebtoken';

// Mock oauthServer before importing the middleware
const mockAuthenticate = jest.fn((req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new Error('Missing authorization header'));
  }

  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, authConfig.jwtSecret) as any;
    req.oauth = {
      token: {
        user: { id: decoded.sub },
        scope: decoded.scope || '',
      },
    };
    next();
  } catch (error) {
    next(new Error('Invalid or expired token'));
  }
});

jest.mock('../services/oauth-server', () => {
  return {
    oauthServer: {
      authenticate: () => mockAuthenticate,
    },
  };
});

describe('Authentication Middleware', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('authenticateToken', () => {
    it('should authenticate valid Bearer token', () => {
      const token = jwt.sign(
        {
          sub: 'test-user-id',
          iss: authConfig.issuer,
          aud: 'plaid-core-exchange',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
          scope: 'openid accounts',
        },
        authConfig.jwtSecret
      );

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      authenticateToken(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        () => {
          expect(mockNext).toHaveBeenCalled();
          expect(mockRequest.user).toBeDefined();
          expect(mockRequest.user?.userId).toBe('test-user-id');
          expect(mockRequest.user?.scopes).toContain('openid');
          expect(mockRequest.user?.scopes).toContain('accounts');
        }
      );
    });

    it('should reject request without authorization header', () => {
      mockRequest.headers = {};

      authenticateToken(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        () => {
          expect(mockResponse.status).toHaveBeenCalledWith(401);
          expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
              error: 'unauthorized',
            })
          );
          expect(mockNext).not.toHaveBeenCalled();
        }
      );
    });

    it('should reject request with invalid token', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      };

      authenticateToken(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        () => {
          expect(mockResponse.status).toHaveBeenCalledWith(401);
          expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
              error: 'unauthorized',
            })
          );
          expect(mockNext).not.toHaveBeenCalled();
        }
      );
    });

    it('should reject request with expired token', () => {
      const expiredToken = jwt.sign(
        {
          sub: 'test-user-id',
          iss: authConfig.issuer,
          aud: 'plaid-core-exchange',
          exp: Math.floor(Date.now() / 1000) - 3600, // Expired
          iat: Math.floor(Date.now() / 1000) - 7200,
          scope: 'openid',
        },
        authConfig.jwtSecret
      );

      mockRequest.headers = {
        authorization: `Bearer ${expiredToken}`,
      };

      authenticateToken(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        () => {
          expect(mockResponse.status).toHaveBeenCalledWith(401);
          expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
              error: 'unauthorized',
            })
          );
          expect(mockNext).not.toHaveBeenCalled();
        }
      );
    });

    it('should handle token with no scope', () => {
      const token = jwt.sign(
        {
          sub: 'test-user-id',
          iss: authConfig.issuer,
          aud: 'plaid-core-exchange',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
        authConfig.jwtSecret
      );

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      authenticateToken(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        () => {
          expect(mockNext).toHaveBeenCalled();
          expect(mockRequest.user?.scopes).toEqual([]);
        }
      );
    });

    it('should handle token with multiple scopes', () => {
      const token = jwt.sign(
        {
          sub: 'test-user-id',
          iss: authConfig.issuer,
          aud: 'plaid-core-exchange',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
          scope: 'openid accounts transactions',
        },
        authConfig.jwtSecret
      );

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      authenticateToken(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        () => {
          expect(mockNext).toHaveBeenCalled();
          expect(mockRequest.user?.scopes).toHaveLength(3);
          expect(mockRequest.user?.scopes).toContain('openid');
          expect(mockRequest.user?.scopes).toContain('accounts');
          expect(mockRequest.user?.scopes).toContain('transactions');
        }
      );
    });
  });
});

