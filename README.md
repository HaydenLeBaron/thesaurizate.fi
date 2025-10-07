# Thesaurum in Cælo

Express.js TypeScript API with PostgreSQL implementing a **ledger-based financial transaction system** with immutable audit trails and Just-In-Time (JIT) balance calculations.

Built with Zapatos for type-safe database queries, pgzod for auto-generated Zod schemas, and node-pg-migrate for database migrations. Features comprehensive Jest testing and k6 load testing.

## Getting Started

### Prerequisites

- Docker
- Docker Compose

### Installation

To get your local environment and Docker container set up, run the following command once from the project root:

```bash
npm run install:all
```

This installs dependencies in both the root directory (for local IDE support) and the `server/` directory.

### Running the Application

1. Start the services:
```bash
npm run dev
```

2. In a separate terminal, run the database migrations:
```bash
npm run db:migrate
```

The API will be available at `http://localhost:3000`.

### API Documentation

**Swagger UI**: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

Interactive API documentation with live testing capabilities.

## Core Concepts

### Ledger-Based Architecture

The system implements an **immutable, append-only transaction ledger** as the single source of truth:

- **No Balance Table**: Balances are never stored; always computed from transactions
- **Immutable Records**: Transactions can never be modified or deleted
- **Audit Trail**: Complete history of all financial movements
- **Idempotency**: UUID-based idempotency keys prevent duplicate transactions

### Transaction Types

1. **Transfers** (`POST /transactions`):
   - Move funds between two users
   - Requires sufficient balance in source account
   - Both users locked during transaction

2. **Deposits** (`POST /users/:id/deposit`):
   - Inject money into the system
   - `source_user_id` is NULL (indicating external source)
   - Always succeeds (no balance check)

### Balance Calculation

Balances are computed Just-In-Time using PostgreSQL functions:

```sql
-- Current balance
SELECT public.get_current_balance(user_id);

-- Historical balance (point-in-time)
SELECT public.get_balance_on_date(user_id, timestamp);
```

**Balance Formula**:
```
balance = SUM(incoming) - SUM(outgoing)

incoming  = WHERE destination_user_id = user_id
outgoing  = WHERE source_user_id = user_id
```

## API Endpoints

### Users
- `POST /users` - Create a new user

### Transactions
- `POST /transactions` - Transfer funds between users
- `POST /users/:id/deposit` - Deposit funds into user account
- `GET /users/:id/balance` - Get current balance (or historical with `?date=` query param)
- `GET /users/:id/transactions` - Get transaction history for a user

### System
- `GET /api-docs` - Swagger UI documentation
- `GET /openapi.json` - OpenAPI specification (manually defined)
- `GET /health` - Health check endpoint

**Note**: All responses use snake_case field names (e.g., `created_at`, `source_user_id`).

### Database Connection (SQLTools)

To connect to the PostgreSQL database using an external tool like the [SQLTools VS Code extension](https://marketplace.visualstudio.com/items?itemName=mtxr.sqltools), use the following settings:

- **Connection Name**: `thesaurum-in-caelo-local`
- **Database Driver**: `PostgreSQL`
- **Server Address**: `localhost`
- **Port**: `5432`
- **Database**: `thesaurum`
- **Username**: `postgres`
- **Password**: `postgres` (select "Save as plaintext in settings" or have it ask on connect)

## Development

**NPM Scripts (from project root):**
- `npm run install:all` - Install dependencies in root and `server/` directories
- `npm run install:server` - Install dependencies in server container
- `npm run db:generate` - Generate Zapatos types and pgzod Zod schemas from database
- `npm run db:migrate` - Run pending SQL migrations
- `npm run db:migrate:generate` - Apply migrations and regenerate types
- `npm run dev` - Start docker-compose services
- `npm run dev:build` - Rebuild and start services
- `npm run down` - Stop docker-compose services
- `npm run setup` - Install server dependencies, generate types, and run migrations
- `npm test` - Run Jest test suite (inside server container)
- `npm run test:watch` - Run Jest tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

## Testing

### Unit and Integration Tests

Run the comprehensive Jest test suite from the project root:

```bash
npm test                  # Run all tests
npm run test:watch        # Watch mode for development
npm run test:coverage     # Generate coverage report
```

Test files are located in `server/src/__tests__/` and cover:
- Health endpoint tests
- User management and balance operations
- Transaction processing (transfers and deposits)
- Edge cases and validation
- Balance accuracy verification
- Schema validation
- Concurrent transaction handling
- Error handling

### Load/Stress Testing with k6

The project includes a k6 stress test that simulates high-concurrency transaction scenarios with 1,000 concurrent virtual users.

Prerequisites:
- Install k6: `brew install k6` (macOS) or see [k6.io/docs](https://k6.io/docs/getting-started/installation/)

Run the stress test:
```bash
k6 run k6-stress-test.js
```

The test:
- Creates 10,000 users with initial balances
- Executes random transactions between users
- Validates performance thresholds (95th percentile < 850ms, < 10% failure rate)
- Verifies data integrity (total balance conservation)

## Architecture

### Single Source of Truth Flow

```
SQL Migrations → PostgreSQL Schema → Zapatos Types + pgzod Schemas → API Validation → Manual OpenAPI Spec
```

- **Database Migrations**: Managed by `node-pg-migrate` with SQL files in `server/migrations/`
- **Zapatos Types**: Auto-generated TypeScript types from database schema
- **Zod Schemas**: Auto-generated from database using `pgzod`
- **OpenAPI Spec**: Manually defined in `server/src/openapi/index.ts`
- **Swagger UI**: Interactive API documentation served via `swagger-ui-express`

### Concurrency Control

The system uses PostgreSQL row-level locks to ensure transaction safety:

1. **Lock Acquisition**: `SELECT FOR UPDATE` on both source and destination users
2. **Deterministic Ordering**: Locks acquired in UUID order to prevent deadlocks
3. **Balance Check**: JIT calculation after acquiring locks
4. **Transaction Insert**: Atomically append to ledger
5. **Commit**: Release locks and make changes visible

### Idempotency

- **Unique Constraint**: `idempotency_key` column has UNIQUE constraint
- **Client-Generated Keys**: Clients provide UUID v4 idempotency keys
- **Automatic Deduplication**: Duplicate requests return 409 Conflict
- **Retry Safety**: Safe to retry failed requests with same key

For detailed architecture information, see [ARCHITECTURE.md](ARCHITECTURE.md).

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
  amount               BIGINT NOT NULL CHECK (amount > 0),  -- cents
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `failed_transactions` (private schema)
Tracks failed transaction attempts for debugging and recovery.

### Functions

- `public.get_current_balance(user_id UUID) → BIGINT` - Current balance
- `public.get_balance_on_date(user_id UUID, date TIMESTAMPTZ) → BIGINT` - Historical balance

### Workflow for Schema Changes

1. Create a new migration: `docker-compose exec server npm run db:migrate:create <migration-name>`
   - Generates a timestamped SQL file (e.g., `20251006202559187_migration-name.sql`)
2. Edit the generated SQL file in `server/migrations/`
3. Apply the migration: `npm run db:migrate`
4. Generate types: `npm run db:generate`
5. Update your API routes and OpenAPI spec as needed

**Additional Migration Commands:**
- `npm run db:migrate` - Apply pending migrations
- `docker-compose exec server npm run db:migrate:down` - Rollback last migration
- `docker-compose exec postgres psql -U postgres -d thesaurum -c "SELECT name, run_on FROM pgmigrations ORDER BY run_on;"` - View migration status

**Note**: Migrations use UTC timestamp-based filenames for proper ordering and to avoid conflicts.

## Important Notes

### Amounts Storage
- All amounts are stored as **BIGINT representing cents** (e.g., $10.00 = 1000 cents)
- This prevents floating-point precision issues
- Always use integers for amount calculations

### Idempotency Keys
- Clients must provide UUID v4 idempotency keys
- Use `crypto.randomUUID()` in Node.js or equivalent
- Retrying with the same key returns 409 Conflict (safe to retry)

### Balance Queries
- Current balance: `GET /users/:id/balance`
- Historical balance: `GET /users/:id/balance?date=2025-01-01T00:00:00Z`
- Balances are always computed from the ledger (never stored)

### Security (Development Mode)
- Password hashing is currently **disabled** for testing
- No authentication/authorization implemented
- Database credentials are hardcoded for development
- **Enable bcrypt hashing before production deployment**
