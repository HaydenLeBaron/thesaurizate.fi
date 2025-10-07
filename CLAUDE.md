# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

Fully functional Express.js TypeScript API with PostgreSQL database implementing a **ledger-based financial transaction system** with immutable audit trails and Just-In-Time (JIT) balance calculations.

Built with:
- **Zapatos** for type-safe database queries and TypeScript type generation
- **pgzod** for auto-generated Zod schemas from PostgreSQL database
- **node-pg-migrate** for database schema migrations
- **Manual OpenAPI specification** defined in TypeScript
- **Swagger UI** for interactive API documentation
- **Jest** for comprehensive unit and integration testing
- **k6** for load and stress testing

## Repository Information

- **Repository**: thesaurum-in-caelo.fi
- **Current State**: Complete financial transaction API with users, transfers, deposits, and balance queries
- **Git Branch**: transactions-mvp

## Architecture

- **Single Source of Truth**: SQL Migrations → Zapatos Types → pgzod Zod Schemas → API Validation → Manual OpenAPI Spec
- **Database Schema**: Defined in `server/migrations/*.sql` files (raw SQL)
- **Zapatos Types**: Auto-generated TypeScript types in `server/zapatos/schema.d.ts`
- **Zod Schemas**: Auto-generated from database using `pgzod` in `server/src/schemas/pgzod/`
- **OpenAPI Spec**: Manually defined in `server/src/openapi/index.ts`
- **Swagger UI**: Interactive API documentation at `http://localhost:3000/api-docs`
- **Field Naming**: All database fields and API responses use snake_case (e.g., `created_at`, `source_user_id`)

## Core Concepts

### Ledger-Based Architecture
- **Immutable Ledger**: Transactions are append-only and never modified or deleted
- **No Balance Table**: Balances are computed on-demand from the transaction ledger
- **JIT Calculation**: PostgreSQL functions calculate balances just-in-time
- **Audit Trail**: Complete history of all financial movements

### Transaction Types
1. **Transfers** (`POST /transactions`): Move funds between users (requires sufficient balance)
2. **Deposits** (`POST /users/:id/deposit`): Inject money into system (source_user_id is NULL)

### Concurrency Control
- Row-level locks (`SELECT FOR UPDATE`) on source/destination users
- Deterministic UUID ordering prevents deadlocks
- Balance check after acquiring locks
- Atomic transaction insertion

### Idempotency
- UUID-based idempotency keys (client-generated)
- UNIQUE constraint on `idempotency_key` column
- Safe retry mechanism (duplicate requests return 409 Conflict)

## API Endpoints

- `POST /users` - Create a new user
- `POST /transactions` - Transfer funds between users
- `POST /users/:id/deposit` - Deposit funds into user account
- `GET /users/:id/balance` - Get current balance (or historical with ?date= query param)
- `GET /users/:id/transactions` - Get transaction history for a user
- `GET /api-docs` - Swagger UI documentation
- `GET /openapi.json` - OpenAPI specification
- `GET /health` - Health check endpoint

## Development Commands

**NPM Scripts (from project root):**
- `npm run install:all` - Install dependencies in root and `server/` directories
- `npm run install:server` - Install dependencies in server container
- `npm run dev` - Start docker-compose services
- `npm run dev:build` - Rebuild and start services
- `npm run down` - Stop docker-compose services
- `npm run db:migrate` - Run pending SQL migrations
- `npm run db:generate` - Generate Zapatos types and pgzod Zod schemas from database
- `npm run db:migrate:generate` - Apply migrations and regenerate types
- `npm run setup` - Install server dependencies, generate types, and run migrations
- `npm test` - Run Jest test suite (inside server container)
- `npm run test:watch` - Run Jest tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

**Inside Server Container (for development):**
- `npm run db:migrate:create <name>` - Create a new migration file
- `npm run db:migrate:down` - Rollback the last migration
- `npm run db:generate:zapatos` - Generate Zapatos TypeScript types only
- `npm run db:generate:zod` - Generate pgzod Zod schemas only

**Check Migration Status:**
- From host: `docker-compose exec postgres psql -U postgres -d thesaurum -c "SELECT name, run_on FROM pgmigrations ORDER BY run_on;"`

## Testing

**Unit and Integration Tests:**
The project includes comprehensive test coverage using Jest. Tests are located in `server/src/__tests__/`:
- `health.test.ts` - Health endpoint tests
- `users.test.ts` - User management and balance tests
- `transactions.test.ts` - Transaction processing tests
- `edge-cases.test.ts` - Edge case validation
- `balance-accuracy.test.ts` - Balance accuracy verification
- `schema-validation.test.ts` - Schema validation tests
- `concurrent.test.ts` - Concurrent transaction tests
- `error-handling.test.ts` - Error handling tests

Run tests from project root:
```bash
npm test                  # Run all tests
npm run test:watch        # Watch mode for development
npm run test:coverage     # Generate coverage report
```

**Load/Stress Testing with k6:**
The project includes a k6 stress test configuration in `k6-stress-test.js` that simulates high-concurrency transaction scenarios.

Prerequisites:
- Install k6: `brew install k6` (macOS) or see [k6 installation docs](https://k6.io/docs/getting-started/installation/)

Run k6 stress test:
```bash
k6 run k6-stress-test.js
```

The stress test:
- Creates 10,000 test users with initial balances
- Ramps up to 1,000 concurrent virtual users
- Executes random transactions between users
- Validates performance thresholds (95th percentile < 850ms, < 10% failure rate)
- Verifies data integrity at teardown (total balance conservation)

## Database Schema

### Tables

#### `users` (public schema)
```sql
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email        TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `transactions` (public schema)
```sql
CREATE TABLE transactions (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  idempotency_key      UUID NOT NULL UNIQUE,
  source_user_id       UUID REFERENCES users(id),  -- NULL = deposit
  destination_user_id  UUID NOT NULL REFERENCES users(id),
  amount               BIGINT NOT NULL CHECK (amount > 0),  -- stored in cents
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `failed_transactions` (private schema)
```sql
CREATE TABLE private.failed_transactions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key      UUID NOT NULL,
  source_user_id       UUID REFERENCES public.users(id),
  destination_user_id  UUID REFERENCES public.users(id),
  amount               INTEGER NOT NULL CHECK (amount > 0),
  error_message        TEXT NOT NULL,
  retry_count          INTEGER NOT NULL DEFAULT 0,
  failed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  addressed_at         TIMESTAMPTZ NULL
);
```

### Functions

#### `public.get_current_balance(user_id UUID) → BIGINT`
Returns current balance for a user (computed from ledger)

#### `public.get_balance_on_date(user_id UUID, date TIMESTAMPTZ) → BIGINT`
Returns historical balance at a specific point in time

## Workflow for Schema Changes

1. Create a new migration: `docker-compose exec server npm run db:migrate:create <migration-name>`
   - This creates a timestamped SQL file in `server/migrations/` (e.g., `20251006202559187_migration-name.sql`)
2. Edit the generated SQL file to add your schema changes
3. Apply the migration: `npm run db:migrate` (from root)
4. Generate types: `npm run db:generate` (from root)
5. Update your API routes to use the new types/schemas
6. Update `server/src/openapi/index.ts` if the API contract changed

**Note**: Migration files use UTC timestamps to ensure proper ordering and prevent conflicts when multiple developers work on migrations.

## SQLTools Connection

The project includes a PostgreSQL database running in Docker. To connect to it directly for querying or management, use the following details with a tool like SQLTools:

- **Driver**: PostgreSQL
- **Host**: `localhost`
- **Port**: `5432`
- **Database**: `thesaurum`
- **User**: `postgres`
- **Password**: `postgres`

## Important Notes

### Security (Development Mode)
- Password hashing is currently **disabled** for testing (see `server/src/routes/users.ts:20`)
- In production, uncomment bcrypt hashing logic
- No authentication/authorization implemented yet
- Database credentials are hardcoded for development

### Amounts Storage
- All amounts are stored as **BIGINT representing cents** (e.g., $10.00 = 1000 cents)
- This prevents floating-point precision issues
- Always use integers for amount calculations

### Idempotency Keys
- Clients must provide UUID v4 idempotency keys
- Use `crypto.randomUUID()` in Node.js or equivalent in other languages
- Retrying with the same key returns 409 Conflict (safe to retry)

### Balance Queries
- Current balance: `GET /users/:id/balance`
- Historical balance: `GET /users/:id/balance?date=2025-01-01T00:00:00Z`
- Balances are always computed from the ledger (never stored)
