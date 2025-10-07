# Architecture Documentation

## Overview

Thesaurum is a type-safe Express.js REST API built with TypeScript, PostgreSQL, and a modern toolchain focused on type safety from database to API contract. The system implements a **ledger-based financial transaction system** with immutable audit trails and Just-In-Time (JIT) balance calculations. The architecture follows a **single source of truth** pattern where the database schema drives type generation throughout the stack.

## Architecture Principles

1. **Database-Driven Type Safety**: SQL migrations are the single source of truth for all type definitions
2. **Auto-Generated Types**: Zapatos and pgzod generate TypeScript types and Zod schemas from the database
3. **Schema Validation**: Zod schemas validate request/response data at the API boundary
4. **Manual API Contract**: OpenAPI specification is manually defined for full control over the public API contract
5. **Dockerized Development**: All services run in containers for consistency across environments
6. **Immutable Ledger**: Transactions are append-only and serve as the single source of truth for balances
7. **JIT Balance Calculation**: Balances are computed on-demand from the transaction ledger

## Tech Stack

### Core Technologies
- **Runtime**: Node.js 20 (Alpine Linux)
- **Framework**: Express.js
- **Language**: TypeScript 5.3+
- **Database**: PostgreSQL 16

### Type Safety & Validation
- **Zapatos**: Type-safe PostgreSQL query builder with auto-generated TypeScript types
- **pgzod**: Auto-generates Zod schemas from PostgreSQL database
- **Zod 4**: Schema validation and type inference
- **zod-openapi**: Bridges Zod schemas to OpenAPI specification

### Testing
- **Jest**: Unit and integration testing framework
- **Supertest**: HTTP assertion library for API testing
- **k6**: Load and stress testing tool

### Documentation
- **OpenAPI 3.1**: API specification manually defined in TypeScript
- **Swagger UI**: Interactive API documentation

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Compose                           │
│  ┌──────────────────────┐      ┌─────────────────────────┐ │
│  │   PostgreSQL 16      │      │   Express.js Server     │ │
│  │   (Port 5432)        │◄─────┤   (Port 3000)           │ │
│  │                      │      │                         │ │
│  │  - thesaurum DB      │      │  - tsx watch (dev)      │ │
│  │  - Persistent volume │      │  - Volume mounted       │ │
│  └──────────────────────┘      └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow Architecture

### Single Source of Truth Flow

```
SQL Migrations (*.sql)
    ↓
PostgreSQL Database Schema
    ↓
┌───────────────────┬──────────────────┐
│                   │                  │
↓                   ↓                  ↓
Zapatos Types    pgzod Schemas    Custom Schemas
(schema.d.ts)    (pgzod/*.ts)     (schemas/*.ts)
    ↓                ↓                  ↓
    └────────────────┴──────────────────┘
                     ↓
              Express Routes
              (validation)
                     ↓
              Manual OpenAPI Spec
              (openapi/index.ts)
                     ↓
              Swagger UI Docs
```

### Type Generation Pipeline

1. **SQL Migrations** → Database schema definition (raw SQL)
2. **Zapatos** → Generates TypeScript types from database (`zapatos/schema.d.ts`)
3. **pgzod** → Generates Zod schemas from database (`schemas/pgzod/*`)
4. **Custom Schemas** → Manual Zod schemas for API contracts (`schemas/users.ts`, `schemas/transactions.ts`)
5. **OpenAPI** → Manual specification using Zod schemas (`openapi/index.ts`)

## Directory Structure

```
thesaurizate.fi/
├── docker-compose.yml          # Container orchestration
├── package.json                # Root package scripts
├── k6-stress-test.js          # Load testing configuration
└── server/
    ├── Dockerfile              # Server container definition
    ├── package.json            # Server dependencies & scripts
    ├── jest.config.js          # Jest testing configuration
    ├── migrations/             # SQL migration files
    │   ├── 20251006202559187_create-transactions-system.sql
    │   ├── 20251007005016874_private-schema.sql
    │   └── 20251007005017000_failed-transactions.sql
    ├── zapatos/                # Auto-generated Zapatos types
    │   └── schema.d.ts         # TypeScript types from DB
    └── src/
        ├── init.ts             # Zod OpenAPI extension (must load first)
        ├── index.ts            # Express app entry point
        ├── db/
        │   ├── index.ts        # Database connection pool
        │   └── migrate.ts      # Migration runner script
        ├── routes/
        │   ├── transactions.ts # Transaction endpoints
        │   └── users.ts        # User endpoints
        ├── services/
        │   └── transactions.ts # Transaction business logic
        ├── schemas/
        │   ├── users.ts        # User Zod schemas for API
        │   ├── transactions.ts # Transaction Zod schemas for API
        │   └── pgzod/          # Auto-generated Zod schemas
        │       ├── index.ts
        │       ├── usersRead.ts
        │       ├── usersWrite.ts
        │       ├── transactionsRead.ts
        │       └── transactionsWrite.ts
        ├── openapi/
        │   └── index.ts        # Manual OpenAPI specification
        └── __tests__/          # Jest test suite
            ├── setup.ts
            ├── app.ts
            ├── health.test.ts
            ├── users.test.ts
            ├── transactions.test.ts
            ├── edge-cases.test.ts
            ├── balance-accuracy.test.ts
            ├── schema-validation.test.ts
            ├── concurrent.test.ts
            └── error-handling.test.ts
```

## Database Layer

### Schema Management

- **Migration System**: [node-pg-migrate](https://github.com/salsita/node-pg-migrate) - battle-tested PostgreSQL migration tool
- **Configuration**: [.node-pg-migraterc](server/.node-pg-migraterc) for migration settings
- **Tracking Table**: `pgmigrations` table tracks applied migrations (managed by node-pg-migrate)
- **Transaction Safety**: Each migration runs in a transaction with automatic rollback on failure
- **Ordering**: Migrations execute in timestamp order (UTC timestamp-based naming)
- **Rollback Support**: Down migrations available via `npm run db:migrate:down`
- **Migration Status**: Check applied migrations with `npm run db:migrate:status`

### Database Connection

- **Connection Pool**: pg.Pool instance managed by [db/index.ts](server/src/db/index.ts#L6)
- **Environment Variable**: `DATABASE_URL` for connection string
- **Error Handling**: Automatic process exit on idle client errors

### Type Generation

#### Zapatos (TypeScript Types)
```bash
npm run db:generate:zapatos
```
- Connects directly to PostgreSQL
- Generates TypeScript types in `zapatos/schema.d.ts`
- Provides type-safe query builder API

#### pgzod (Zod Schemas)
```bash
npm run db:generate:zod
```
- Generates separate read/write schemas for each table
- Output: `src/schemas/pgzod/`
- Custom type mapping: `timestamp=z.coerce.date()`
- Strategy: `readwrite` (separate schemas for reads/writes)

## Application Layer

### Request Lifecycle

1. **Request arrives** → Express middleware
2. **Route matching** → Express router ([routes/users.ts](server/src/routes/users.ts), [routes/transactions.ts](server/src/routes/transactions.ts))
3. **Validation** → Zod schema parsing (`.safeParse()`)
4. **Business logic** → Service layer ([services/transactions.ts](server/src/services/transactions.ts))
5. **Database query** → Zapatos type-safe queries
6. **Response** → JSON serialization
7. **Documentation** → OpenAPI spec describes contract

### Validation Strategy

- **Input Validation**: Zod schemas validate POST/PUT request bodies
- **Parameter Validation**: UUIDs and query parameters validated via Zod
- **Type Safety**: Zapatos ensures database query type safety
- **Error Handling**: Zod validation errors return 400 with details

### API Routes

| Method | Endpoint | Description | Validation |
|--------|----------|-------------|------------|
| POST | `/users` | Create a new user | `CreateUserSchema` |
| POST | `/transactions` | Transfer funds between users | `CreateTransactionSchema` |
| POST | `/users/:id/deposit` | Deposit funds into account | `CreateDepositSchema` |
| GET | `/users/:id/balance` | Get current/historical balance | `UserIdPathSchema`, `BalanceQuerySchema` |
| GET | `/users/:id/transactions` | Get transaction history | `UserIdPathSchema` |
| GET | `/health` | Health check | None |
| GET | `/api-docs` | Swagger UI | None |
| GET | `/openapi.json` | OpenAPI spec | None |

## Type Safety Implementation

### Initialization Order

The [init.ts](server/src/init.ts#L1-6) file **must** be imported first in [index.ts](server/src/index.ts#L2) to extend Zod globally with OpenAPI metadata support before any schemas are created.

### Schema Layers

1. **Database Layer**: Zapatos types (`zapatos.schema.users.Selectable`, `zapatos.schema.transactions.Selectable`)
2. **Validation Layer**: pgzod schemas (`usersWrite`, `transactionsWrite`)
3. **API Layer**: Custom Zod schemas with OpenAPI metadata (`UserSchema`, `TransactionSchema`)

### Example: Type Flow for Creating a Transaction

```typescript
// 1. Request validation (API layer)
const parseResult = CreateTransactionSchema.parse(req.body);

// 2. Business logic (Service layer)
const transaction = await executeTransaction({
  idempotencyKey: parseResult.idempotency_key,
  sourceUserId: parseResult.source_user_id,
  destinationUserId: parseResult.destination_user_id,
  amount: parseResult.amount,
});

// 3. Database operations (Zapatos layer)
// - Row-level locks on source/destination users
// - JIT balance calculation
// - Transaction insertion
// Type: zapatos.schema.transactions.Selectable

// 4. Response (API layer)
res.status(201).json(transaction);
```

## Financial Transaction System

### Ledger Architecture

The system implements an **immutable, append-only transaction ledger** as the single source of truth:

- **No Balance Table**: Balances are never stored; always computed from transactions
- **Immutable Records**: Transactions can never be modified or deleted
- **Audit Trail**: Complete history of all financial movements
- **Idempotency**: UUID-based idempotency keys prevent duplicate transactions

### Transaction Types

1. **Transfers** (`POST /transactions`):
   - Move funds between two users
   - `source_user_id` → `destination_user_id`
   - Requires sufficient balance in source account

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

### Failed Transactions

The `private.failed_transactions` table tracks transaction failures:

- **Error Logging**: Captures error messages for debugging
- **Retry Tracking**: Counts retry attempts
- **Audit Trail**: Records source, destination, amount of failed attempts
- **Resolution Tracking**: `addressed_at` timestamp for manual intervention

## OpenAPI Documentation

### Manual Specification

The OpenAPI spec is **manually defined** in [openapi/index.ts](server/src/openapi/index.ts) using:
- `zod-openapi` for schema transformation
- Zod `.meta()` for OpenAPI metadata (descriptions, examples)
- Full control over API contract details

### Schema Metadata Pattern

```typescript
export const CreateTransactionSchema = z.object({
  idempotency_key: z.string().uuid(),
  source_user_id: z.string().uuid(),
  destination_user_id: z.string().uuid(),
  amount: z.number().int().positive(),
}).meta({
  description: 'Create a new financial transaction',
});
```

### Swagger UI

- **Endpoint**: `http://localhost:3000/api-docs`
- **Engine**: swagger-ui-express
- **Source**: Dynamically serves the OpenAPI spec from memory

## Development Workflow

### Initial Setup

```bash
npm run install:all      # Install all dependencies
npm run setup            # Install server deps, migrate DB, generate types
npm run dev              # Start Docker services
```

### Schema Change Workflow

1. **Create migration**: `docker-compose exec server npm run db:migrate:create <migration-name>` (creates timestamped SQL file in `server/migrations/`)
2. **Edit migration**: Add SQL DDL statements to the generated migration file
3. **Apply migration**: `npm run db:migrate`
4. **Generate types**: `npm run db:generate`
5. **Update routes**: Modify Express routes to use new types
6. **Update OpenAPI**: Manually update `openapi/index.ts` if API contract changed

**Note**: Migration files use UTC timestamp-based naming (e.g., `20251006202559187_migration-name.sql`) to ensure proper ordering and avoid conflicts.

### Available Commands

#### Root Package Scripts
- `npm run dev` → Start all services
- `npm run dev:build` → Rebuild containers and start
- `npm run down` → Stop all services
- `npm run db:migrate` → Apply pending migrations
- `npm run db:generate` → Regenerate Zapatos types + pgzod schemas
- `npm run db:migrate:generate` → Apply migrations and regenerate types
- `npm run setup` → Full setup from scratch
- `npm test` → Run Jest test suite
- `npm run test:watch` → Run tests in watch mode
- `npm run test:coverage` → Generate test coverage report

#### Server Container Scripts
- `npm run dev` → Start dev server with tsx watch
- `npm run build` → Compile TypeScript
- `npm run start` → Run compiled JavaScript
- `npm run db:migrate:create` → Create new migration file
- `npm run db:migrate:down` → Rollback last migration
- `npm run db:migrate:status` → Show migration status
- `npm run db:generate:zapatos` → Zapatos types only
- `npm run db:generate:zod` → pgzod schemas only

## Docker Configuration

### Services

#### PostgreSQL Container
- **Image**: postgres:16-alpine
- **Port**: 5432 (exposed to host)
- **Database**: thesaurum
- **Credentials**: postgres/postgres (development only)
- **Volume**: Persistent storage at `postgres_data`
- **Health Check**: pg_isready every 5 seconds
- **Extensions**: uuid-ossp (for UUID generation)

#### Express Server Container
- **Base**: node:20-alpine
- **Port**: 3000 (exposed to host)
- **Working Dir**: /app
- **Volume Mount**: `./server:/app` (live reload)
- **Command**: `npm run dev` (tsx watch mode)
- **Depends On**: postgres (waits for health check)

### Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `NODE_ENV`: development
- `PORT`: 3000 (default)

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

**Purpose**: Store user identity and credentials. Each user has exactly one implicit account.

#### `transactions` (public schema)
```sql
CREATE TABLE transactions (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  idempotency_key      UUID NOT NULL UNIQUE,
  source_user_id       UUID REFERENCES users(id),  -- NULL = deposit
  destination_user_id  UUID NOT NULL REFERENCES users(id),
  amount               BIGINT NOT NULL CHECK (amount > 0),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Purpose**: Immutable, append-only ledger of all financial movements. Single source of truth for balances.

**Indexes**:
- `idx_transactions_user_balance` - Composite index for JIT balance calculation
- `idx_transactions_source` - Transaction history for source users
- `idx_transactions_dest` - Transaction history for destination users

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

**Purpose**: Track failed transaction attempts for debugging and recovery.

#### `pgmigrations` (tracking)
```sql
-- Automatically managed by node-pg-migrate
-- Migration tracking table
```
*Note: This table is created and managed automatically by node-pg-migrate*

### Functions

#### `get_current_balance(user_id UUID) → BIGINT`
```sql
SELECT public.get_current_balance(user_id);
```
- Returns current balance for a user
- Computed from transaction ledger
- STABLE PARALLEL SAFE for performance

#### `get_balance_on_date(user_id UUID, date TIMESTAMPTZ) → BIGINT`
```sql
SELECT public.get_balance_on_date(user_id, '2025-01-01'::timestamptz);
```
- Returns historical balance at a point in time
- Enables time-travel queries
- STABLE PARALLEL SAFE for performance

### Field Naming Convention

**All fields use `snake_case`** (e.g., `created_at`, `source_user_id`) to match PostgreSQL conventions. This is maintained throughout:
- Database columns
- Zapatos types
- pgzod schemas
- API request/response bodies
- OpenAPI specification

## Key Design Decisions

### Why Ledger-Based Architecture?

- **Auditability**: Complete immutable history of all transactions
- **Accuracy**: Single source of truth prevents balance drift
- **Flexibility**: Can compute balances at any point in time
- **Compliance**: Meets financial regulatory requirements
- **Debugging**: Full transaction history simplifies troubleshooting

### Why JIT Balance Calculation?

- **Consistency**: Eliminates potential for balance/ledger mismatch
- **Simplicity**: No complex balance update logic
- **Performance**: PostgreSQL indexes make aggregation fast
- **Correctness**: Impossible to have incorrect balances

### Why Zapatos Over an ORM?

- **Type Safety**: Auto-generated types directly from database schema
- **No Magic**: Explicit SQL-like queries without ORM abstraction overhead
- **Performance**: No runtime schema inspection or heavy query builders
- **Vendor Lock-in**: Can migrate away more easily than with Drizzle or Prisma

### Why pgzod?

- **Zod Integration**: Leverages existing Zod validation infrastructure
- **Auto-Generation**: Reduces manual schema maintenance
- **Separation**: Read/write schemas prevent accidental data modification
- **Type Mapping**: Customizable type conversions (e.g., timestamp → Date)

### Why Manual OpenAPI Spec?

- **Flexibility**: Full control over API documentation details
- **Versioning**: Explicit API contract changes
- **Metadata**: Rich descriptions and examples via Zod `.meta()`
- **Decoupling**: API contract independent of database schema evolution

### Why node-pg-migrate?

- **Battle-Tested**: Widely-used library with proven reliability in production
- **Raw SQL Support**: Write migrations in plain SQL (our preferred approach)
- **Rollback Support**: Down migrations for safe schema changes
- **Transaction Safety**: Automatic rollback on migration failures
- **Migration Locking**: Prevents concurrent migration execution
- **No Vendor Lock-in**: Plain SQL migrations are portable
- **Active Maintenance**: Regular updates and community support

## Error Handling

### Validation Errors
- **400 Bad Request**: Invalid request body or parameters
- **Details**: Zod validation errors included in response

### Business Logic Errors
- **400 Bad Request**: Insufficient funds for transaction
- **409 Conflict**: Duplicate idempotency key

### Database Errors
- **409 Conflict**: Unique constraint violations (email, idempotency_key)
- **500 Internal Server Error**: Database query failures
- **Logging**: Errors logged to console for debugging

### Not Found
- **404 Not Found**: Resource doesn't exist (future: user lookup)

### Migration Errors
- **Automatic Rollback**: Transaction rollback on migration failure
- **Exit Code 1**: Process exits to prevent running with incorrect schema

## Testing Strategy

### Unit & Integration Tests (Jest)

Comprehensive test suite covering all critical paths:

1. **Health Tests** (`health.test.ts`): API health check validation
2. **User Tests** (`users.test.ts`): User creation and balance operations
3. **Transaction Tests** (`transactions.test.ts`): Transfer and deposit flows
4. **Edge Cases** (`edge-cases.test.ts`): Boundary conditions and error cases
5. **Balance Accuracy** (`balance-accuracy.test.ts`): Ledger calculation verification
6. **Schema Validation** (`schema-validation.test.ts`): Zod schema testing
7. **Concurrency** (`concurrent.test.ts`): Parallel transaction handling
8. **Error Handling** (`error-handling.test.ts`): Error scenarios and recovery

**Test Commands**:
```bash
npm test                  # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

### Load & Stress Testing (k6)

The `k6-stress-test.js` configuration simulates production-like load:

- **Setup**: Creates 10,000 test users with initial balances
- **VUs**: Ramps up to 1,000 concurrent virtual users
- **Duration**: 30 seconds sustained load
- **Operations**: Random transactions between users
- **Thresholds**:
  - 95th percentile response time < 850ms
  - Failure rate < 10%
- **Verification**: Balance conservation check at teardown

**k6 Command**:
```bash
k6 run k6-stress-test.js
```

## Security Considerations

### Current State (Development)
- Hardcoded database credentials
- No authentication/authorization
- Password hashing disabled (for testing)
- CORS not configured
- No rate limiting

### Production Recommendations
- Environment-based secrets management
- Authentication middleware (JWT, OAuth)
- Enable bcrypt password hashing
- CORS configuration
- Input sanitization
- Rate limiting (express-rate-limit)
- SQL injection protection (parameterized queries via Zapatos)
- Row-level security (PostgreSQL RLS)

## Performance Considerations

### Database
- **Connection Pooling**: pg.Pool for efficient connection reuse
- **Indexing**: Composite indexes for JIT balance calculation
- **Queries**: Zapatos generates optimized SQL
- **Functions**: STABLE PARALLEL SAFE for query parallelization
- **Lock Ordering**: Deterministic UUID ordering prevents deadlocks

### API
- **Single Source of Truth**: No redundant type definitions
- **Compiled TypeScript**: Production runs compiled JavaScript
- **Docker**: Lightweight Alpine images
- **Stateless**: Horizontal scaling ready

### Balance Calculation
- **Optimized Indexes**: `idx_transactions_user_balance` covers common queries
- **Function Inlining**: PostgreSQL can inline simple functions
- **Materialized Views**: Future optimization for read-heavy workloads

## Monitoring & Observability

### Current State
- Basic console logging
- Health check endpoint at `/health`

### Production Recommendations
- Structured logging (winston, pino)
- Application Performance Monitoring (APM)
- Database query performance tracking
- Error tracking (Sentry, Rollbar)
- Transaction metrics (volume, latency, failures)
- Balance drift monitoring (should never occur)

## Future Architecture Considerations

### Scalability
- Horizontal scaling: Stateless API design enables load balancing
- Read replicas: PostgreSQL read replicas for balance queries
- Caching: Redis for frequently accessed balances
- Partitioning: Partition transactions table by date

### Maintainability
- Automated testing: CI/CD pipeline with test coverage
- API versioning: `/v1/transactions` for backwards compatibility
- Documentation: Keep OpenAPI spec in sync with implementation

### Feature Additions
- Withdrawals: Support for removing money from the system
- Transaction reversal: Compensating transactions for refunds
- Multi-currency: Support for different currencies
- Background jobs: Async processing for reporting
- GraphQL layer: Apollo Server for flexible querying
- Real-time: WebSocket support for live balance updates
