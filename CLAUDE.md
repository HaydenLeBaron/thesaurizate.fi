# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

Fully functional Express.js TypeScript API with PostgreSQL database for managing greetings in different languages.

Built with:
- **Drizzle ORM** for type-safe database queries and schema management
- **Auto-generated Zod schemas** from Drizzle schema using `drizzle-zod`
- **Auto-generated OpenAPI specification** from Zod schemas using `@asteasolutions/zod-to-openapi`
- **Swagger UI** for interactive API documentation

## Repository Information

- **Repository**: thesaurum-in-caelo.fi
- **Current State**: Complete API with all endpoints implemented
- **Git Branch**: main

## Architecture

- **Single Source of Truth**: Database schema → Migrations → Zod → OpenAPI → Swagger UI
- **Database Schema**: Defined in `src/db/schema.ts` using Drizzle ORM
- **Zod Schemas**: Auto-generated from Drizzle schema
- **OpenAPI Spec**: Auto-generated from Zod schemas
- **Swagger UI**: Interactive API documentation at `http://localhost:3000/api-docs`

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
- `npm run dev` - Start docker-compose services
- `npm run dev:build` - Rebuild and start services
- `npm run down` - Stop docker-compose services
- `npm run db:generate` - Generate migrations from schema changes
- `npm run db:migrate` - Run pending migrations
- `npm run db:push` - Push schema changes directly (development only)
- `npm run db:studio` - Open Drizzle Studio (database GUI)

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

