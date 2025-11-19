# Plaid Core Exchange Integration Plan

## Overview

Transform the existing ledger-based financial API to support Plaid Core Exchange integration by implementing OAuth 2.0/OIDC authentication and FDX-compliant endpoints that map users to accounts and expose transaction data in Plaid's expected format.

## Architecture Mapping

- **Users → Accounts**: Each user in `users` table represents one account (1:1 mapping)
- **Transactions**: Existing `transactions` table provides transaction history
- **Balances**: Use existing JIT balance calculation functions (`get_current_balance`, `get_balance_on_date`)

## Implementation Steps

### 1. Database Schema Extensions

**File**: `server/migrations/[timestamp]_plaid-core-exchange.sql`

Add fields to `users` table to support Plaid requirements:

- `account_number` TEXT - Account number for payment networks
- `routing_number` TEXT - Routing number (bank identifier)
- `account_type` TEXT - Account type (e.g., 'checking', 'savings', 'depository')
- `contact_email` TEXT - Contact email (can default to user email)
- `contact_phone` TEXT - Optional phone number
- `account_name` TEXT - Display name for the account

**Note**: Since the system uses 1 user = 1 account, we extend the users table rather than creating a separate accounts table.

### 2. OAuth 2.0 / OIDC Authentication Implementation

**Files**:

- `server/src/routes/auth.ts` (new)
- `server/src/services/auth.ts` (new)
- `server/src/middleware/auth.ts` (new)

Implement OAuth 2.0 server with OIDC compliance:

- **Token Exchange Endpoint** (`POST /oauth/token`): Handle client credentials and authorization code flows
- **OIDC Well-Known Configuration** (`GET /.well-known/openid-configuration`): Return OIDC discovery document
- **JWKS Endpoint** (`GET /.well-known/jwks.json`): Return public keys for token verification
- **UserInfo Endpoint** (`GET /oauth/userinfo`): Return user identity information
- **Client Credentials**: Support Plaid's client_id/client_secret authentication
- **JWT Token Generation**: Issue access tokens and ID tokens (if using OIDC)

**Middleware**: Create authentication middleware to validate Bearer tokens and extract user context.

### 3. Plaid Core Exchange API Endpoints

**File**: `server/src/routes/plaid.ts` (new)

Implement FDX-compliant endpoints:

#### GET /accounts

- List all accounts for authenticated user
- Map each user to an account object
- Return account ID, type, and basic info

#### GET /accounts/{accountId}

- Get detailed account information
- Include current balance (using `get_current_balance`)
- Include account type, routing number, account number
- Support liability information (if applicable)

#### GET /accounts/{accountId}/transactions

- Return transaction history for account
- Map existing `transactions` table data to FDX transaction format
- Support pagination (limit/offset or cursor-based)
- Filter by date range if needed
- Transform amounts and timestamps to FDX format

#### GET /accounts/{accountId}/payment-networks

- Return payment network information
- Include routing number and account number
- Support ACH, wire transfer networks
- Return in FDX payment network format

#### GET /accounts/{accountId}/contact

- Return contact information for account
- Include email, phone, name
- Map from users table and new contact fields

#### GET /customers/current (optional, if not using OIDC)

- Return current customer/user ID from OAuth token
- Only needed if not using OIDC UserInfo endpoint

### 4. Schema Definitions

**File**: `server/src/schemas/plaid.ts` (new)

Create Zod schemas for Plaid/FDX API:

- Account schema (with balance, type, identifiers)
- Transaction schema (FDX format)
- Payment network schema
- Contact schema
- OAuth token request/response schemas

**Note**: After database migration, run `npm run db:generate` to regenerate pgzod schemas, then create manual Zod schemas for API request/response validation.

### 5. Service Layer

**File**: `server/src/services/plaid.ts` (new)

Business logic for Plaid endpoints:

- `getAccountsForUser(userId)`: Map user to account format
- `getAccountDetails(accountId)`: Get account with balance
- `getAccountTransactions(accountId, filters)`: Query and format transactions
- `getPaymentNetworks(accountId)`: Return routing/account info
- `getAccountContact(accountId)`: Return contact information

Reuse existing services:

- `getUserBalance()` from `services/transactions.ts`
- Transaction queries from existing code

### 6. Update OpenAPI Specification

**File**: `server/src/openapi/index.ts`

Add all new Plaid Core Exchange endpoints to OpenAPI spec:

- OAuth endpoints (token, userinfo, well-known)
- Account endpoints
- Transaction endpoints
- Payment network endpoints
- Contact endpoints

Follow FDX API specification format for request/response schemas.

### 7. Route Registration

**File**: `server/src/index.ts`

Register new route handlers:

- `app.use('/oauth', authRouter)` - OAuth endpoints
- `app.use('/accounts', plaidRouter)` - Plaid Core Exchange endpoints (with auth middleware)
- `app.use('/.well-known', wellKnownRouter)` - OIDC discovery endpoints

### 8. Configuration

**File**: `server/src/config/auth.ts` (new)

Configuration for OAuth:

- JWT secret key (from environment variable)
- Token expiration times
- Client credentials (Plaid's client_id/client_secret)
- OIDC issuer URL

### 9. Error Handling

Ensure all endpoints return appropriate HTTP status codes:

- 401 Unauthorized for invalid/missing tokens
- 403 Forbidden for insufficient permissions
- 404 Not Found for non-existent accounts
- 400 Bad Request for invalid parameters
- Follow FDX error response format

### 10. Testing Considerations

- Unit tests for OAuth token generation/validation
- Integration tests for Plaid endpoints
- Test account mapping (user → account)
- Test transaction format conversion
- Test authentication middleware

## Migration Strategy

1. Create database migration for new user fields
2. Run migration: `npm run db:migrate`
3. Regenerate types: `npm run db:generate`
4. Implement OAuth infrastructure
5. Implement Plaid endpoints
6. Update OpenAPI spec
7. Test with Plaid's test environment

## Dependencies to Add

- `jsonwebtoken` - JWT token generation/verification
- `jwks-rsa` - JWKS key management (if using RSA)
- `oauth2-server` or custom OAuth implementation
- Potentially `@types/jsonwebtoken`

## Notes

- The system's 1:1 user-to-account mapping simplifies account management
- Existing balance calculation functions can be reused directly
- Transaction ledger format needs transformation to FDX format
- OAuth implementation should support both client credentials (for Plaid) and user authentication flows
- All amounts remain in cents (integers) as per existing architecture
