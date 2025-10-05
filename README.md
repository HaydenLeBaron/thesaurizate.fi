# Thesaurum in Cælo

Express.js TypeScript API with PostgreSQL for managing greetings in different languages.

Built with Drizzle ORM for type-safe database queries and auto-generated Zod schemas.

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
- `GET /openapi.json` - OpenAPI specification (auto-generated from Zod schemas)
- `GET /health` - Health check endpoint

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
- `npm run install:all` - Install dependencies in root and `server/` directories.
- `npm run setup` - **DEPRECATED**. Installs dependencies and runs migrations. Use `install:all` and `db:migrate` instead.
- `npm run install:server` - Install dependencies in server container
- `npm run db:generate` - Generate migrations from schema changes
- `npm run db:migrate` - Run pending migrations
- `npm run db:push` - Push schema changes directly (development only)
- `npm run db:studio` - Open Drizzle Studio (database GUI)
- `npm run dev` - Start docker-compose services
- `npm run dev:build` - Rebuild and start services
- `npm run down` - Stop docker-compose services

### Architecture

- **Database Schema**: Defined in `src/db/schema.ts` using Drizzle ORM
- **Zod Schemas**: Auto-generated from Drizzle schema using `drizzle-zod`
- **OpenAPI Spec**: Auto-generated from Zod schemas using `@asteasolutions/zod-to-openapi`
- **Swagger UI**: Interactive API documentation served via `swagger-ui-express`
- **Single Source of Truth**: Database schema → Migrations → Zod → OpenAPI → Swagger UI
