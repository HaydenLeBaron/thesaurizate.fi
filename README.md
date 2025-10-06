# Thesaurum in Cælo

Express.js TypeScript API with PostgreSQL for managing greetings in different languages.

Built with Zapatos for type-safe database queries, pgzod for auto-generated Zod schemas, and node-pg-migrate for database migrations.

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

### API Endpoints

- `GET /greetings` - Get all greetings
- `GET /greetings/:language` - Get greetings by language (en, es, fr, de, it, pt, ru, zh, ja, ko)
- `POST /greetings` - Create a new greeting
- `DELETE /greetings/:id` - Delete a greeting by ID
- `GET /api-docs` - Swagger UI documentation
- `GET /openapi.json` - OpenAPI specification (manually defined)
- `GET /health` - Health check endpoint

**Note**: All responses use snake_case field names (e.g., `created_at`, not `createdAt`).

### Database Connection (SQLTools)

To connect to the PostgreSQL database using an external tool like the [SQLTools VS Code extension](https://marketplace.visualstudio.com/items?itemName=mtxr.sqltools), use the following settings:

- **Connection Name**: `thesaurum-in-caelo-local`
- **Database Driver**: `PostgreSQL`
- **Server Address**: `localhost`
- **Port**: `5432`
- **Database**: `thesaurum`
- **Username**: `postgres`
- **Password**: `postgres` (select "Save as plaintext in settings" or have it ask on connect)

### Development

**NPM Scripts (from project root):**
- `npm run install:all` - Install dependencies in root and `server/` directories
- `npm run install:server` - Install dependencies in server container
- `npm run db:generate` - Generate Zapatos types and pgzod Zod schemas from database
- `npm run db:migrate` - Run pending SQL migrations
- `npm run dev` - Start docker-compose services
- `npm run dev:build` - Rebuild and start services
- `npm run down` - Stop docker-compose services
- `npm run setup` - Install server dependencies, generate types, and run migrations

### Architecture

- **Database Migrations**: Managed by `node-pg-migrate` with SQL files in `server/migrations/`
- **Zapatos Types**: Auto-generated TypeScript types from database schema
- **Zod Schemas**: Auto-generated from database using `pgzod`
- **OpenAPI Spec**: Manually defined in `server/src/openapi/index.ts`
- **Swagger UI**: Interactive API documentation served via `swagger-ui-express`
- **Single Source of Truth**: SQL Migrations → Zapatos Types → pgzod Zod Schemas → API Validation → Manual OpenAPI Spec

For detailed architecture information, see [ARCHITECTURE.md](ARCHITECTURE.md).

### Workflow for Schema Changes

1. Create a new migration: `docker-compose exec server npm run db:migrate:create <migration-name>`
   - Generates a timestamped SQL file (e.g., `1728233328668_migration-name.sql`)
2. Edit the generated SQL file in `server/migrations/`
3. Apply the migration: `npm run db:migrate`
4. Generate types: `npm run db:generate`
5. Update your API routes and OpenAPI spec as needed

**Additional Migration Commands:**
- `npm run db:migrate` - Apply pending migrations
- `docker-compose exec server npm run db:migrate:down` - Rollback last migration
- `docker-compose exec postgres psql -U postgres -d thesaurum -c "SELECT name, run_on FROM pgmigrations ORDER BY run_on;"` - View migration status

**Note**: Migrations use timestamp-based filenames for proper ordering and to avoid conflicts.
