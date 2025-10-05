# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

This is a newly initialized repository with minimal content. The codebase structure and development commands will be established as the project develops.

## Repository Information

- **Repository**: thesaurum-in-caelo.fi
- **Current State**: Empty repository with only README.md
- **Git Branch**: main

## Plan

- [x] Initialize repository

- [ ] Initialize a development environment that allows me to run a dockerized PostgreSQL database
  - [ ] The database should support database migrations.
  - [ ] create a dummy "greetings" table with columns "id" (auto-incrementingprimary key), "language" (enum), "greeting" (text), and "created_at" (timestamp)

- [ ] Create a simple, dockerized Express.js typescript server with:
  - [ ] A zod schema
  - [ ] A generatable openapi spec from the zod schema
  - [ ] A simple GET endpoint at "/greetings" that returns all greetings from the database
  - [ ] A simple GET endpoint at "/greetings/:language" that returns all greetings from the database in that language
  - [ ] A simple POST endpoint at "/greetings" that creates a new greeting in the database
  - [ ] A simple DELETE endpoint at "/greetings/:id" that deletes a greeting from the database by id

