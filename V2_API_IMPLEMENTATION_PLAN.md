# V2 API Implementation Plan

## Overview
Implement a `/v2` API that copies the `/v1` API endpoint business logic but reshapes it to follow the Plaid Core Exchange API specification structure.

## Current V1 API Structure

### Endpoints:
- `POST /accounts` - Create a new account
- `POST /transactions` - Transfer funds between accounts
- `POST /accounts/:id/deposit` - Deposit funds into an account
- `GET /accounts/:id/balance` - Get account balance (current or historical)
- `GET /accounts/:id/transactions` - Get transaction history for an account

## Target V2 API Structure (Plaid Core Exchange API)

### Endpoints:
1. **GET /v2/accounts** - Search and view customer accounts
   - Maps to: List all accounts (equivalent to searching accounts)
   - Business logic: Query all accounts from database
   - Response: Array of account objects

2. **GET /v2/accounts/{accountId}** - Get account balances, liabilities, and other information
   - Maps to: `GET /accounts/:id/balance` from v1
   - Business logic: Reuse `getAccountBalance()` and `getAccountBalanceOnDate()` services
   - Response: Account object with balance information

3. **GET /v2/accounts/{accountId}/contact** - Get account contact information
   - Maps to: User information linked to the account
   - Business logic: Query account's associated user information
   - Response: Contact information (email, etc.)

4. **GET /v2/accounts/{accountId}/transactions** - List all account transactions
   - Maps to: `GET /accounts/:id/transactions` from v1
   - Business logic: Reuse existing transaction query logic
   - Response: Array of transaction objects

5. **GET /v2/accounts/{accountId}/payment-networks** - Get payment networks supported by an account
   - Maps to: New endpoint (not in v1)
   - Business logic: Return supported payment networks (e.g., ACH, WIRE)
   - Response: Array of payment network objects

## Implementation Steps

### Phase 1: Create V2 Schemas
- [ ] Create `server/src/schemas/v2/accounts.ts` - V2 account schemas
- [ ] Create `server/src/schemas/v2/transactions.ts` - V2 transaction schemas
- [ ] Create `server/src/schemas/v2/payment-networks.ts` - Payment network schemas

### Phase 2: Create V2 Routes
- [ ] Create `server/src/routes/v2/accounts.ts` - V2 account routes
  - `GET /v2/accounts` - List accounts
  - `GET /v2/accounts/:accountId` - Get account details with balance
  - `GET /v2/accounts/:accountId/contact` - Get contact information
  - `GET /v2/accounts/:accountId/payment-networks` - Get payment networks
- [ ] Create `server/src/routes/v2/transactions.ts` - V2 transaction routes
  - `GET /v2/accounts/:accountId/transactions` - List account transactions

### Phase 3: Update Main Application
- [ ] Update `server/src/index.ts` to mount v2 routes
- [ ] Update `server/src/__tests__/app.ts` to include v2 routes for testing

### Phase 4: Update OpenAPI Specification
- [ ] Update `server/src/openapi/index.ts` to include v2 endpoints
- [ ] Ensure v2 endpoints are properly documented

### Phase 5: Create V2 Unit Tests
- [ ] Create `server/src/__tests__/v2/accounts.test.ts` - V2 account tests
- [ ] Create `server/src/__tests__/v2/transactions.test.ts` - V2 transaction tests
- [ ] Adapt existing v1 tests to v2 structure

## Business Logic Mapping

### Account Listing (GET /v2/accounts)
- **V1 Equivalent**: None (new functionality)
- **Implementation**: Query all accounts from database
- **Response Shape**: Array of account objects with user information

### Account Details (GET /v2/accounts/{accountId})
- **V1 Equivalent**: `GET /accounts/:id/balance`
- **Implementation**: 
  - Query account from database
  - Get balance using `getAccountBalance()` or `getAccountBalanceOnDate()` if date query param provided
  - Combine account info + balance in response
- **Response Shape**: Account object with balance, liabilities (empty for now), and metadata

### Account Contact (GET /v2/accounts/{accountId}/contact)
- **V1 Equivalent**: None (new functionality)
- **Implementation**: 
  - Query account from database
  - Query associated user information
  - Return contact details (email, etc.)
- **Response Shape**: Contact information object

### Account Transactions (GET /v2/accounts/{accountId}/transactions)
- **V1 Equivalent**: `GET /accounts/:id/transactions`
- **Implementation**: Reuse existing transaction query logic from v1
- **Response Shape**: Array of transaction objects (same as v1)

### Payment Networks (GET /v2/accounts/{accountId}/payment-networks)
- **V1 Equivalent**: None (new functionality)
- **Implementation**: 
  - Query account from database
  - Return supported payment networks (hardcoded for now: ACH, WIRE)
- **Response Shape**: Array of payment network objects

## Response Shape Considerations

### Plaid-style Response Structure:
- Use camelCase for JSON responses (even though DB uses snake_case)
- Include metadata fields (timestamps, IDs)
- Include nested objects where appropriate
- Follow Plaid's response patterns

## Testing Strategy

### Test Coverage:
1. **Account Listing Tests**
   - List all accounts
   - Empty list when no accounts exist
   - Proper account data structure

2. **Account Details Tests**
   - Get account with balance
   - Get account with historical balance (date query param)
   - Handle non-existent account
   - Validate response structure

3. **Account Contact Tests**
   - Get contact information for account
   - Handle non-existent account
   - Validate contact data structure

4. **Account Transactions Tests**
   - List transactions for account
   - Empty list when no transactions
   - Proper transaction ordering
   - Include both sent and received transactions

5. **Payment Networks Tests**
   - Get payment networks for account
   - Handle non-existent account
   - Validate payment network structure

## Notes

- V2 API maintains the same business logic as V1 but with different endpoint structure
- All database operations reuse existing services and functions
- Response shapes are adapted to match Plaid Core Exchange API patterns
- V1 API remains unchanged and functional
- Both APIs can coexist in the same application
