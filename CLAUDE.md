# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

Fully functional Express.js TypeScript API with PostgreSQL database for managing greetings in different languages.

Built with:
- **Zapatos** for type-safe database queries and TypeScript type generation
- **pgzod** for auto-generated Zod schemas from PostgreSQL database
- **node-pg-migrate** for database schema migrations
- **Manual OpenAPI specification** defined in TypeScript
- **Swagger UI** for interactive API documentation

## Repository Information

- **Repository**: thesaurum-in-caelo.fi
- **Current State**: Complete API with all endpoints implemented
- **Git Branch**: main

## Architecture

- **Single Source of Truth**: SQL Migrations → Zapatos Types → pgzod Zod Schemas → API Validation → Manual OpenAPI Spec
- **Database Schema**: Defined in `server/migrations/*.sql` files (raw SQL)
- **Zapatos Types**: Auto-generated TypeScript types in `server/zapatos/schema.d.ts`
- **Zod Schemas**: Auto-generated from database using `pgzod` in `server/src/schemas/pgzod/`
- **OpenAPI Spec**: Manually defined in `server/src/openapi/index.ts`
- **Swagger UI**: Interactive API documentation at `http://localhost:3000/api-docs`
- **Field Naming**: All database fields and API responses use snake_case (e.g., `created_at`)

## API Endpoints

- `GET /greetings` - Get all greetings
- `GET /greetings/:language` - Get greetings by language (en, es, fr, de, it, pt, ru, zh, ja, ko)
- `POST /greetings` - Create a new greeting
- `DELETE /greetings/:id` - Delete a greeting by ID
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
- `npm run setup` - Install server dependencies, generate types, and run migrations

**Inside Server Container (for development):**
- `npm run db:migrate:create <name>` - Create a new migration file
- `npm run db:migrate:down` - Rollback the last migration
- `npm run db:generate:zapatos` - Generate Zapatos TypeScript types only
- `npm run db:generate:zod` - Generate pgzod Zod schemas only

**Check Migration Status:**
- From host: `docker-compose exec postgres psql -U postgres -d thesaurum -c "SELECT name, run_on FROM pgmigrations ORDER BY run_on;"`

## Workflow for Schema Changes

1. Create a new migration: `docker-compose exec server npm run db:migrate:create <migration-name>`
   - This creates a timestamped SQL file in `server/migrations/` (e.g., `20251006170848670_migration-name.sql`)
2. Edit the generated SQL file to add your schema changes
3. Apply the migration: `npm run db:migrate` (from root)
4. Generate types: `npm run db:generate` (from root)
5. Update your API routes to use the new types/schemas
6. Update `server/src/openapi/index.ts` if the API contract changed

**Note**: Migration files use timestamps to ensure proper ordering and prevent conflicts when multiple developers work on migrations.

## SQLTools Connection

The project includes a PostgreSQL database running in Docker. To connect to it directly for querying or management, use the following details with a tool like SQLTools:

- **Driver**: PostgreSQL
- **Host**: `localhost`
- **Port**: `5432`
- **Database**: `thesaurum`
- **User**: `postgres`
- **Password**: `postgres`

## Plan

- [x] Initialize repository

- [x] Initialize a development environment that allows me to run a dockerized PostgreSQL database
  - [x] The database should support database migrations.
  - [x] create a dummy "greetings" table with columns "id" (auto-incrementingprimary key), "language" (enum), "greeting" (text), and "created_at" (timestamp)

- [x] Create a simple, dockerized Express.js typescript server with:
  - [x] A zod 4 schema
  - [x] A generatable openapi spec from the zod schema
  - [x] A simple GET endpoint at "/greetings" that returns all greetings from the database
  - [x] A simple GET endpoint at "/greetings/:language" that returns all greetings from the database in that language
  - [x] A simple POST endpoint at "/greetings" that creates a new greeting in the database
  - [x] A simple DELETE endpoint at "/greetings/:id" that deletes a greeting from the database by id

