# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Task Management API** built with NestJS (TypeScript). It is a template for a production-ready backend service supporting CRUD for tasks with categories, statuses, validation, Swagger docs, and CI/CD via GitHub Actions.

The NestJS application source lives under `app/`. All commands below should be run from inside the `app/` directory.

## Commands

```bash
# Install dependencies
npm install

# Development (watch mode)
npm run start:dev

# Build for production
npm run build
npm run start:prod

# Lint (auto-fix)
npm run lint

# Format code
npm run format

# Run all unit tests
npm run test

# Run a single test file
npx jest src/path/to/file.spec.ts

# Run tests with coverage
npm run test:cov

# Run e2e tests
npm run test:e2e
```

## Architecture

The app follows NestJS's module-based architecture. Each domain feature (e.g., `tasks`) is encapsulated in its own module under `src/modules/`:

```
app/src/
  modules/
    tasks/
      tasks.controller.ts   # Route handlers
      tasks.service.ts      # Business logic
      tasks.module.ts       # Module declaration
      dto/                  # Data Transfer Objects (class-validator)
      entities/             # Data model definitions
  common/                   # Shared guards, filters, interceptors, pipes
  config/                   # Configuration (env-based)
  main.ts                   # Bootstrap: binds port from PORT env var (default 3000)
  app.module.ts             # Root module — imports feature modules here
```

**Key architectural points:**
- New feature modules must be imported into `app.module.ts` to be active.
- DTOs use `class-validator` decorators for input validation.
- Swagger UI is served at `/api-docs`.
- Port is configured via the `PORT` environment variable (falls back to `3000`).

## Data Model

```ts
Task {
  id: number
  title: string
  description?: string
  status: "pending" | "done"
  category: string   // e.g., "work" | "study" | "personal"
  createdAt: Date
}
```

## Environment Variables

Create a `.env` file in `app/`:

```env
PORT=3000
DATABASE_URL=your_database_url
```

## TypeScript Configuration

- Target: ES2023, `nodenext` module resolution
- `strictNullChecks` enabled; `noImplicitAny` is disabled
- `emitDecoratorMetadata` and `experimentalDecorators` enabled (required for NestJS DI)
- Compiled output goes to `app/dist/`
