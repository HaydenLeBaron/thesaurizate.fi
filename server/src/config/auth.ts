/**
 * OAuth 2.0 / OIDC Configuration
 * 
 * Configuration for Plaid Core Exchange OAuth authentication
 */

// TODO: audit this file - do these development values after the (||) allow circumventing of production secrets?

export const authConfig = {
    // JWT secret key (should be set via environment variable in production)
    jwtSecret: process.env.JWT_SECRET || 'development-secret-key-change-in-production',

    // Token expiration times (in seconds)
    accessTokenExpiration: 3600, // 1 hour
    idTokenExpiration: 3600, // 1 hour

    // OIDC Issuer URL
    issuer: process.env.OIDC_ISSUER || 'http://localhost:3000',

    // Plaid client credentials (should be set via environment variables)
    plaidClientId: process.env.PLAID_CLIENT_ID || 'plaid-client-id',
    plaidClientSecret: process.env.PLAID_CLIENT_SECRET || 'plaid-client-secret',

    // Supported grant types
    supportedGrantTypes: ['client_credentials', 'authorization_code'] as const,

    // Supported scopes
    supportedScopes: ['openid', 'profile', 'accounts', 'transactions', 'admin'] as const,
};

