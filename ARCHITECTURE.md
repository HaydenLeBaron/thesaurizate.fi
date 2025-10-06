# Architecture Documentation

## Overview

Thesaurum is a type-safe Express.js REST API built with TypeScript, PostgreSQL, and a modern toolchain focused on type safety from database to API contract. The architecture follows a **single source of truth** pattern where the database schema drives type generation throughout the stack.

## Architecture Principles

1. **Database-Driven Type Safety**: SQL migrations are the single source of truth for all type definitions
2. **Auto-Generated Types**: Zapatos and pgzod generate TypeScript types and Zod schemas from the database
3. **Schema Validation**: Zod schemas validate request/response data at the API boundary
4. **Manual API Contract**: OpenAPI specification is manually defined for full control over the public API contract
5. **Dockerized Development**: All services run in containers for consistency across environments

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
4. **Custom Schemas** → Manual Zod schemas for API contracts (`schemas/greetings.ts`)
5. **OpenAPI** → Manual specification using Zod schemas (`openapi/index.ts`)

## Directory Structure

```
thesaurum-in-caelo.fi/
├── docker-compose.yml          # Container orchestration
├── package.json                # Root package scripts
└── server/
    ├── Dockerfile              # Server container definition
    ├── package.json            # Server dependencies & scripts
    ├── migrations/             # SQL migration files
    │   ├── 001_initial_schema.sql
    │   ├── 002_add_dummy_greetings.sql
    │   └── 003_add_description_to_greetings.sql
    ├── zapatos/                # Auto-generated Zapatos types
    │   └── schema.d.ts         # TypeScript types from DB
    └── src/
        ├── init.ts             # Zod OpenAPI extension (must load first)
        ├── index.ts            # Express app entry point
        ├── db/
        │   ├── index.ts        # Database connection pool
        │   └── migrate.ts      # Migration runner script
        ├── routes/
        │   └── greetings.ts    # Greeting endpoints
        ├── schemas/
        │   ├── greetings.ts    # Custom Zod schemas for API
        │   └── pgzod/          # Auto-generated Zod schemas
        │       ├── index.ts
        │       ├── greetingsRead.ts
        │       ├── greetingsWrite.ts
        │       ├── migrationsRead.ts
        │       └── migrationsWrite.ts
        └── openapi/
            └── index.ts        # Manual OpenAPI specification
```

## Database Layer

### Schema Management

- **Migration System**: [node-pg-migrate](https://github.com/salsita/node-pg-migrate) - battle-tested PostgreSQL migration tool
- **Configuration**: [.node-pg-migraterc](server/.node-pg-migraterc) for migration settings
- **Tracking Table**: `pgmigrations` table tracks applied migrations (managed by node-pg-migrate)
- **Transaction Safety**: Each migration runs in a transaction with automatic rollback on failure
- **Ordering**: Migrations execute in timestamp order (001, 002, 003, etc.)
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
2. **Route matching** → Express router ([routes/greetings.ts](server/src/routes/greetings.ts))
3. **Validation** → Zod schema parsing (`.safeParse()`)
4. **Database query** → Zapatos type-safe queries
5. **Response** → JSON serialization
6. **Documentation** → OpenAPI spec describes contract

### Validation Strategy

- **Input Validation**: `CreateGreetingSchema` validates POST request bodies
- **Parameter Validation**: `LanguageEnum` validates URL parameters
- **Type Safety**: Zapatos ensures database query type safety
- **Error Handling**: Zod validation errors return 400 with details

### API Routes

| Method | Endpoint | Description | Validation |
|--------|----------|-------------|------------|
| GET | `/greetings` | List all greetings | None |
| GET | `/greetings/:language` | Filter by language | `LanguageEnum` |
| POST | `/greetings` | Create greeting | `CreateGreetingSchema` |
| DELETE | `/greetings/:id` | Delete by ID | Integer validation |
| GET | `/health` | Health check | None |
| GET | `/api-docs` | Swagger UI | None |
| GET | `/openapi.json` | OpenAPI spec | None |

## Type Safety Implementation

### Initialization Order

The [init.ts](server/src/init.ts#L1-6) file **must** be imported first in [index.ts](server/src/index.ts#L2) to extend Zod globally with OpenAPI metadata support before any schemas are created.

### Schema Layers

1. **Database Layer**: Zapatos types (`zapatos.schema.greetings.Selectable`)
2. **Validation Layer**: pgzod schemas (`greetingsWrite`, `greetingsRead`)
3. **API Layer**: Custom Zod schemas with OpenAPI metadata (`GreetingSchema`, `CreateGreetingSchema`)

### Example: Type Flow for Creating a Greeting

```typescript
// 1. Request validation (API layer)
const parseResult = CreateGreetingSchema.safeParse(req.body);

// 2. Database insertion (Zapatos layer)
const newGreeting = await db.insert('greetings', parseResult.data).run(pool);
// Type: zapatos.schema.greetings.Insertable

// 3. Response (API layer)
res.status(201).json(newGreeting);
// Type: zapatos.schema.greetings.Selectable
```

## OpenAPI Documentation

### Manual Specification

The OpenAPI spec is **manually defined** in [openapi/index.ts](server/src/openapi/index.ts) using:
- `zod-openapi` for schema transformation
- Zod `.meta()` for OpenAPI metadata (descriptions, examples)
- Full control over API contract details

### Schema Metadata Pattern

```typescript
export const LanguageEnum = z.enum([...]).meta({
  description: 'Language code',
  example: 'en',
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
2. **Edit migration**: Add SQL DDL statements to the generated migration file (e.g., `1728233328668_migration-name.sql`)
3. **Apply migration**: `npm run db:migrate`
4. **Generate types**: `npm run db:generate`
5. **Update routes**: Modify Express routes to use new types
6. **Update OpenAPI**: Manually update `openapi/index.ts` if API contract changed

**Note**: Migration files use timestamp-based naming (e.g., `1728233328668_initial-schema.sql`) to ensure proper ordering and avoid conflicts.

### Available Commands

#### Root Package Scripts
- `npm run dev` → Start all services
- `npm run dev:build` → Rebuild containers and start
- `npm run down` → Stop all services
- `npm run db:migrate` → Apply pending migrations
- `npm run db:generate` → Regenerate Zapatos types + pgzod schemas
- `npm run setup` → Full setup from scratch

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

#### `greetings`
```sql
CREATE TABLE greetings (
  id           serial PRIMARY KEY,
  language     language_enum NOT NULL,
  greeting     text NOT NULL,
  created_at   timestamp DEFAULT now() NOT NULL,
  description  text NULL  -- Added in migration 003
);
```

#### `pgmigrations` (tracking)
```sql
-- Automatically managed by node-pg-migrate
-- Migration tracking table
```
*Note: This table is created and managed automatically by node-pg-migrate*

### Enums

#### `language_enum`
```sql
CREATE TYPE language_enum AS ENUM(
  'en', 'es', 'fr', 'de', 'it',
  'pt', 'ru', 'zh', 'ja', 'ko'
);
```

### Field Naming Convention

**All fields use `snake_case`** (e.g., `created_at`, `language_enum`) to match PostgreSQL conventions. This is maintained throughout:
- Database columns
- Zapatos types
- pgzod schemas
- API request/response bodies
- OpenAPI specification

## Key Design Decisions

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

### Database Errors
- **500 Internal Server Error**: Database query failures
- **Logging**: Errors logged to console for debugging

### Not Found
- **404 Not Found**: Resource doesn't exist (e.g., DELETE non-existent greeting)

### Migration Errors
- **Automatic Rollback**: Transaction rollback on migration failure
- **Exit Code 1**: Process exits to prevent running with incorrect schema

## Security Considerations

### Current State (Development)
- Hardcoded database credentials
- No authentication/authorization
- CORS not configured
- No rate limiting

### Production Recommendations
- Environment-based secrets management
- Authentication middleware (JWT, OAuth)
- CORS configuration
- Input sanitization
- Rate limiting (express-rate-limit)
- SQL injection protection (parameterized queries via Zapatos)

## Performance Considerations

### Database
- **Connection Pooling**: pg.Pool for efficient connection reuse
- **Indexing**: Serial primary keys auto-indexed
- **Queries**: Zapatos generates optimized SQL

### API
- **Single Source of Truth**: No redundant type definitions
- **Compiled TypeScript**: Production runs compiled JavaScript
- **Docker**: Lightweight Alpine images

## Testing Strategy

### Current State
No automated tests currently implemented.

### Recommended Approach
1. **Unit Tests**: Validate Zod schemas and business logic
2. **Integration Tests**: Test database queries with test database
3. **API Tests**: Validate endpoints against OpenAPI spec
4. **Tools**: Jest, Supertest, @faker-js/faker for test data

## Monitoring & Observability

### Current State
- Basic console logging
- Health check endpoint at `/health`

### Production Recommendations
- Structured logging (winston, pino)
- Application Performance Monitoring (APM)
- Database query performance tracking
- Error tracking (Sentry, Rollbar)

## Future Architecture Considerations

### Scalability
- Horizontal scaling: Stateless API design enables load balancing
- Read replicas: PostgreSQL read replicas for read-heavy workloads
- Caching: Redis for frequently accessed data

### Maintainability
- Automated testing: CI/CD pipeline with test coverage
- API versioning: `/v1/greetings` for backwards compatibility
- Documentation: Keep OpenAPI spec in sync with implementation

### Feature Additions
- GraphQL layer: Apollo Server for flexible querying
- Real-time: WebSocket support for live updates
- Background jobs: Bull queue for async processing
