# Task Management API — NestJS Template

A production-ready **to-do / task management** REST API that serves as a learning template for building and deploying backend services with:

- **NestJS** — modular, TypeScript-first Node.js framework
- **Prisma** — type-safe ORM with PostgreSQL
- **BullMQ + Redis** — background job queues (email delivery, scheduled task expiration)
- **GitHub Actions** — automated lint, test, Docker build, and deploy pipelines
- **Azure Container Apps + ACR** — cloud hosting via Azure Student account
- **Azure Database for PostgreSQL** — managed relational database
- **Azure Key Vault** — centralised secret management for all sensitive configuration

> This repository is intentionally structured as a guided template. Each layer (auth, tasks, queues, email) demonstrates a real-world pattern you can copy into your own projects.

---

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Environment Variables](#environment-variables)
5. [Local Setup](#local-setup)
6. [Database Setup (Prisma)](#database-setup-prisma)
7. [Running the App](#running-the-app)
8. [API Versioning](#api-versioning)
9. [API Reference](#api-reference)
10. [Background Jobs (BullMQ)](#background-jobs-bullmq)
11. [CI/CD with GitHub Actions](#cicd-with-github-actions)
12. [Deploying to Azure](#deploying-to-azure)
13. [Project Structure](#project-structure)

---

## Features


| Area           | What it demonstrates                                                             |
| -------------- | -------------------------------------------------------------------------------- |
| Auth           | JWT registration & login, `@UseGuards`, custom `@CurrentUser()` decorator        |
| Tasks          | Full CRUD, ownership checks, `NotFoundException` / `ForbiddenException`          |
| Validation     | `class-validator` DTOs, global `ValidationPipe` with `transform: true`           |
| Error handling | Global `HttpExceptionFilter` — every error returns the same JSON shape           |
| Email          | Nodemailer via `@nestjs-modules/mailer`, sent through a BullMQ job queue         |
| Queues         | BullMQ workers: email delivery + cron-based task-expiration checker              |
| Database       | Prisma with PostgreSQL adapter (`@prisma/adapter-pg`), `OnModuleInit` connection |
| Versioning     | URI-based API versioning (`/v1/...`), `VERSION_NEUTRAL` for utility routes       |
| Docs           | Swagger UI at `/api-docs`, reflects versioned paths automatically                |
| Docker         | Multi-stage Dockerfile (dev → build → production), non-root user                 |
| CI/CD          | GitHub Actions: PR checks (lint + test + Docker build), push-to-main deploy      |
| Cloud          | Azure Container Registry + Container Apps, OIDC keyless auth                     |
| Secrets        | Azure Key Vault — secrets injected into Container App via managed identity       |
| Database       | Azure Database for PostgreSQL Flexible Server (any PostgreSQL provider works)    |


---

## Architecture

```
┌──────────────┐     HTTP      ┌──────────────────────────────────────┐
│   Client     │ ────────────► │           NestJS App                 │
└──────────────┘               │                                      │
                               │  Guard → Pipe → Controller           │
                               │       └──► Service                   │
                               │              └──► Prisma (Postgres)  │
                               │              └──► QueueService        │
                               └──────────────────────┬───────────────┘
                                                      │ BullMQ jobs
                               ┌──────────────────────▼───────────────┐
                               │         Redis (Redis Cloud)          │
                               │   email queue  |  expiration queue   │
                               └──────────────────────┬───────────────┘
                                                      │
                               ┌──────────────────────▼───────────────┐
                               │       BullMQ Workers (consumers)     │
                               │  QueueConsumer → EmailService → SMTP │
                               │  TaskExpirationConsumer (every 1min) │
                               └──────────────────────────────────────┘
```

**Request lifecycle inside NestJS:**

```
Request
  → Exception Filter (wraps everything)
    → Guard (JwtAuthGuard → validates JWT → sets request.user)
      → Pipe (ValidationPipe → validates & transforms DTOs)
        → Controller handler
          → Service (business logic, throws HttpException on errors)
            → Response
```

---

## Prerequisites

Install the following before starting:


| Tool                                                                       | Version           | Notes                                |
| -------------------------------------------------------------------------- | ----------------- | ------------------------------------ |
| [Node.js](https://nodejs.org)                                              | 20 or 24 LTS      | The Dockerfile uses `node:24-alpine` |
| [npm](https://www.npmjs.com)                                               | bundled with Node |                                      |
| [Docker](https://www.docker.com/products/docker-desktop)                   | any recent        | Required for containerized runs      |
| [Git](https://git-scm.com)                                                 | any               |                                      |
| [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) | latest            | For manual Azure operations          |


**Cloud accounts you need:**


| Service                    | Purpose                                                        | Notes                                                                                         |
| -------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Azure Student**          | All Azure resources (Postgres, ACR, Container Apps, Key Vault) | [azure.microsoft.com/free/students](https://azure.microsoft.com/free/students/) — $100 credit |
| **Redis Cloud** (redis.io) | BullMQ job queue broker                                        | [redis.io/try-free](https://redis.io/try-free/) — free 30 MB instance is enough               |
| **SMTP provider**          | Sending emails via the mailer module                           | Gmail App Password, SendGrid, Mailtrap (dev), etc.                                            |


**PostgreSQL — Azure Database for PostgreSQL is used in this template.** Any standard PostgreSQL provider works as a drop-in replacement because Prisma only needs a `DATABASE_URL` connection string. Alternatives: [Supabase](https://supabase.com), [Neon](https://neon.tech), or a local Docker container for development.

---

## Environment Variables

Create a file at `app/.env`. All variables are required unless marked optional.

```env
# ── Server ────────────────────────────────────────────────────────────────────
PORT=3000

# ── Database (PostgreSQL) ─────────────────────────────────────────────────────
# Azure Database for PostgreSQL Flexible Server format:
#   postgresql://<admin>:<password>@<server>.postgres.database.azure.com:5432/<db>?sslmode=require
# Any other provider: replace with their connection string — only this variable changes.
DATABASE_URL=postgresql://adminuser:password@myserver.postgres.database.azure.com:5432/taskdb?sslmode=require

# ── JWT ───────────────────────────────────────────────────────────────────────
JWT_SECRET=replace-with-a-long-random-string
JWT_EXPIRES_IN=1h         # optional, default: 1h

# ── Redis (Redis Cloud) ───────────────────────────────────────────────────────
# Find these in your Redis Cloud dashboard → Database → Connect → redis-cli
REDIS_HOST=redis-xxxxx.c1.us-east-1-2.ec2.redns.redis-cloud.com
REDIS_PORT=12345
REDIS_USERNAME=default
REDIS_PASSWORD=your-redis-cloud-password

# ── Mailer (SMTP) ─────────────────────────────────────────────────────────────
MAILER_HOST=smtp.gmail.com          # or smtp.sendgrid.net, etc.
MAILER_PORT=587                     # 465 for SSL, 587 for STARTTLS
MAILER_USER=you@gmail.com
MAILER_PASS=your-app-password       # Gmail: use an App Password, not your login password
MAILER_FROM=you@gmail.com
MAILER_FROM_NAME=Task App           # optional, default: "No Reply"
```

> **Gmail tip:** Go to Google Account → Security → 2-Step Verification → App Passwords. Generate one for "Mail". Use that 16-character password as `MAILER_PASS`.

> **Redis Cloud tip:** After creating a free database, go to **Connect** → copy the **Public endpoint** (host:port), username (`default`), and the password shown on the database page.

---

## Local Setup

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>

# 2. Install dependencies  (run from inside app/)
cd app
npm install

# 3. Create your .env file
cp .env.example .env     # then fill in the values above
```

---

## Database Setup (Prisma)

Prisma manages the database schema via migration files.

```bash
# Inside app/

# Apply all migrations to your database (creates tables)
npx prisma migrate deploy

# (Development) Create a new migration after editing schema.prisma
npx prisma migrate dev --name describe-your-change

# Open Prisma Studio — a visual database browser
npx prisma studio

# Regenerate the Prisma client after schema changes
npx prisma generate
```

The schema defines three models — see [app/prisma/schema.prisma](app/prisma/schema.prisma):

```
User  { id, email, password, name, created_at }
Category { id, user_id → User, name, color, created_at }
Task  { id, user_id → User, category_id → Category?, title, description, status, due_date, created_at }
```

---

## Running the App

All commands are run from inside `app/`.

```bash
# Development — watch mode with hot reload
npm run start:dev

# Run SQL migrations (PostgreSQL)
npm run db:migrate

# Optional sample seed data
npm run db:seed

# Production build
npm run build
npm run start:prod

# Lint (auto-fix)
npm run lint

# Format code
npm run format

# Unit tests
npm run test

# Single test file
npx jest src/path/to/file.spec.ts

# Test coverage
npm run test:cov

# End-to-end tests
npm run test:e2e
```

Swagger UI is available at `http://localhost:3000/api-docs` once the app is running.

**Health check endpoint:**

```bash
curl http://localhost:3000/health
# → 200 OK
```

### Docker quickstart (app + Postgres + Redis)

From repository root:

```bash
# Create env file for docker compose
cp .env.docker.example .env

docker compose up --build
```

The app container runs `npm run db:migrate` automatically before startup.

### Docker deploy artifact

From inside `app/`:

```bash
IMAGE_NAME=<your-registry>/<image-name> TAG=<tag> npm run docker:deploy
```

---

## API Versioning

This app uses **URI versioning** — the version is embedded in the URL path (`/v1/`, `/v2/`, …). It is configured globally in [main.ts](app/src/main.ts):

```ts
app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '1',
});
```

`defaultVersion: '1'` means any controller that does **not** declare a version explicitly is still served under `/v1/`. This is a safe fallback but explicit versions are preferred for clarity.

### How versions are declared

**On a whole controller** — all routes in the controller share the same version:

```ts
// app/src/task/task.controller.ts
@Controller({ version: '1', path: 'tasks' })
export class TaskController { ... }
// → GET /v1/tasks, POST /v1/tasks, etc.
```

**On a single route method** — useful when one endpoint gets upgraded while the rest stay on v1:

```ts
@Controller({ version: '1', path: 'tasks' })
export class TaskController {
  @Get()
  findAllV1() { ... }           // GET /v1/tasks

  @Get()
  @Version('2')
  findAllV2() { ... }           // GET /v2/tasks
}
```

**Version-neutral** — the route is reachable without any version prefix, regardless of the default:

```ts
// app/src/app.controller.ts
@Controller({ version: VERSION_NEUTRAL })
export class AppController {
  @Get('health')
  getHealth() { ... }           // GET /health  (not /v1/health)
}
```

### Adding a v2 endpoint

Create a new controller (or add a method) and set `version: '2'`. Both versions are served simultaneously — no breaking change to existing clients.

```ts
// app/src/task/task.controller.v2.ts
@Controller({ version: '2', path: 'tasks' })
export class TaskControllerV2 {
  // new or changed behaviour
}
```

Register it in `task.module.ts` alongside the existing controller:

```ts
controllers: [TaskController, TaskControllerV2]
```

### Swagger

`SwaggerModule.createDocument` is called **after** `app.enableVersioning`, so the Swagger UI at `/api-docs` automatically reflects all versioned paths.

---

## API Reference

The API uses **URI versioning**. All versioned endpoints are prefixed with `/v1/`. The `/health` endpoint is version-neutral and has no prefix.

All `/v1/tasks` and `/v1/categories` endpoints require a `Bearer <token>` header.

### Utility (version-neutral)


| Method | Path      | Description                      |
| ------ | --------- | -------------------------------- |
| `GET`  | `/health` | Health check — no version prefix |


### Auth


| Method | Path                | Body                        | Description                 |
| ------ | ------------------- | --------------------------- | --------------------------- |
| `POST` | `/v1/auth/register` | `{ name, email, password }` | Create account, returns JWT |
| `POST` | `/v1/auth/login`    | `{ email, password }`       | Sign in, returns JWT        |
| `GET`  | `/v1/auth/profile`  | —                           | Returns current user info   |


### Tasks


| Method   | Path            | Body                                                | Description                               |
| -------- | --------------- | --------------------------------------------------- | ----------------------------------------- |
| `GET`    | `/v1/tasks`     | —                                                   | List all tasks for the authenticated user |
| `POST`   | `/v1/tasks`     | `{ title, description, due_date, category_id? }`    | Create a task                             |
| `PATCH`  | `/v1/tasks/:id` | `{ title?, description?, due_date?, category_id? }` | Update a task                             |
| `DELETE` | `/v1/tasks/:id` | —                                                   | Delete a task (204 No Content)            |


### Categories (bonus API)


| Method   | Path                 | Body                | Description                                    |
| -------- | -------------------- | ------------------- | ---------------------------------------------- |
| `GET`    | `/v1/categories`     | —                   | List all categories for the authenticated user |
| `POST`   | `/v1/categories`     | `{ name, color? }`  | Create a category                              |
| `PATCH`  | `/v1/categories/:id` | `{ name?, color? }` | Update a category                              |
| `DELETE` | `/v1/categories/:id` | —                   | Delete a category (204 No Content)             |


### Submission checklist

- Cloud API base URL (example: `https://your-app.region.azurecontainerapps.io`)
- Cloud Swagger Docs URL: `<base-url>/api-docs`
- Confirm the cloud instance is running before instructor grading starts

### Error response shape (all endpoints)

Every error — validation failure, unauthorized, not found, server crash — returns the same structure:

```json
{
  "statusCode": 422,
  "message": "Unprocessable Entity",
  "errors": ["title must be longer than or equal to 3 characters"],
  "timestamp": "2026-04-16T10:00:00.000Z",
  "path": "/tasks"
}
```

---

## Background Jobs (BullMQ)

The app uses two BullMQ queues backed by Redis Cloud:

### Email Queue

When a task is created, `TaskService` calls `QueueService.sendEmail()` which enqueues a job. The `QueueConsumer` worker picks it up and calls `EmailService` to send via SMTP.

```
POST /tasks
  → TaskService.create()
    → QueueService.sendEmail()   # adds job to Redis
      → QueueConsumer.process()  # async worker
        → EmailService.sendEmail()
```

Jobs are retried up to 3 times with a 3-second initial delay. Completed jobs are kept for 3 runs then removed.

### Task Expiration Queue

On startup (`OnModuleInit`), `QueueService` schedules a repeating job (`*/1 * * * *` = every minute) that checks for and processes expired tasks. The `TaskExpirationConsumer` handles those jobs.

---

## CI/CD with GitHub Actions

Two top-level workflows handle the full pipeline:

### `pr.yml` — runs on every pull request


| Job            | What it does                                                      |
| -------------- | ----------------------------------------------------------------- |
| `changes`      | Detects if `app/**` or workflow files changed (skips jobs if not) |
| `lint`         | Runs `npm run lint`                                               |
| `test`         | Runs `npm run test`                                               |
| `docker-build` | Builds the Docker image (does not push)                           |


### `deploy.yml` — runs on push to `main`


| Job           | What it does                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| `changes`     | Same path detection                                                                                      |
| `docker-push` | Authenticates to Azure via OIDC, logs into ACR, builds & pushes image tagged `sha-<commit>` and `latest` |
| `deploy`      | Updates the Container App to the new image, smoke-tests `GET /health`                                    |


### GitHub repository secrets and variables to configure

Go to your repo → **Settings → Secrets and variables → Actions**.

**Secrets** (sensitive values):


| Secret                  | Where to find it                                 |
| ----------------------- | ------------------------------------------------ |
| `AZURE_CLIENT_ID`       | Azure App Registration → Application (client) ID |
| `AZURE_TENANT_ID`       | Azure Active Directory → Tenant ID               |
| `AZURE_SUBSCRIPTION_ID` | Azure Portal → Subscriptions                     |


**Variables** (non-sensitive):


| Variable            | Example value           |
| ------------------- | ----------------------- |
| `ACR_LOGIN_SERVER`  | `myregistry.azurecr.io` |
| `ACR_REGISTRY_NAME` | `myregistry`            |


> The pipelines use **OIDC (keyless) authentication** — no stored Azure credentials. The App Registration needs a federated credential pointing to your GitHub repository.

---

## Deploying to Azure

This is a one-time setup. Once done, every push to `main` deploys automatically.

**Secret management approach:** all sensitive values (`DATABASE_URL`, `JWT_SECRET`, passwords) are stored in **Azure Key Vault**. The Container App is assigned a system-managed identity that has permission to read those secrets. No plaintext credentials are stored in GitHub or in Container App configuration.

```
Key Vault
  └── secrets: DATABASE_URL, JWT_SECRET, REDIS_PASSWORD, MAILER_PASS
        ↑ Key Vault Secrets User role
  Container App (system-assigned managed identity)
        ↓ secretref: keyvaultref:...
  Environment variables injected at runtime
```

---

### Step 1 — Create core Azure resources

```bash
# Log in
az login

# Create a resource group (change location to suit you)
az group create --name rg-anmind-production --location eastasia

# Create an Azure Container Registry (ACR)
az acr create \
  --resource-group rg-anmind-production \
  --name <your-acr-name> \
  --sku Basic \
  --admin-enabled false

# Create a Container Apps environment
az containerapp env create \
  --name env-anmind \
  --resource-group rg-anmind-production \
  --location eastasia

# Create the Container App with a placeholder image and system-assigned managed identity
az containerapp create \
  --name containerapp-anmind \
  --resource-group rg-anmind-production \
  --environment env-anmind \
  --image mcr.microsoft.com/azuredocs/containerapps-helloworld:latest \
  --target-port 3000 \
  --ingress external \
  --min-replicas 0 \
  --max-replicas 2 \
  --system-assigned
```

---

### Step 2 — Create Azure Database for PostgreSQL

> If you prefer a different PostgreSQL provider (Supabase, Neon, etc.), skip this step and use their connection string as `DATABASE_URL` in Key Vault later.

```bash
# Create a Flexible Server (cheapest tier: Burstable B1ms)
az postgres flexible-server create \
  --resource-group rg-anmind-production \
  --name <your-pg-server-name> \
  --location eastasia \
  --admin-user adminuser \
  --admin-password "<strong-password>" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 16

# Create the application database
az postgres flexible-server db create \
  --resource-group rg-anmind-production \
  --server-name <your-pg-server-name> \
  --database-name taskdb

# Allow connections from Azure services
az postgres flexible-server firewall-rule create \
  --resource-group rg-anmind-production \
  --name <your-pg-server-name> \
  --rule-name allow-azure-services \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

Your connection string will be:

```
postgresql://adminuser:<password>@<your-pg-server-name>.postgres.database.azure.com:5432/taskdb?sslmode=require
```

---

### Step 3 — Create Azure Key Vault and store secrets

```bash
# Create the Key Vault
az keyvault create \
  --name <your-keyvault-name> \
  --resource-group rg-anmind-production \
  --location eastasia \
  --enable-rbac-authorization true

# Store all sensitive values as Key Vault secrets
az keyvault secret set \
  --vault-name <your-keyvault-name> \
  --name database-url \
  --value "postgresql://adminuser:<password>@<your-pg-server-name>.postgres.database.azure.com:5432/taskdb?sslmode=require"

az keyvault secret set \
  --vault-name <your-keyvault-name> \
  --name jwt-secret \
  --value "<long-random-string>"

az keyvault secret set \
  --vault-name <your-keyvault-name> \
  --name redis-password \
  --value "<your-redis-cloud-password>"

az keyvault secret set \
  --vault-name <your-keyvault-name> \
  --name mailer-pass \
  --value "<your-smtp-app-password>"
```

---

### Step 4 — Grant the Container App access to Key Vault

The Container App's system-assigned managed identity needs the **Key Vault Secrets User** role so it can read secrets at runtime.

```bash
# Get the managed identity's principal ID
PRINCIPAL_ID=$(az containerapp show \
  --name containerapp-anmind \
  --resource-group rg-anmind-production \
  --query identity.principalId \
  --output tsv)

# Get the Key Vault resource ID
KV_ID=$(az keyvault show \
  --name <your-keyvault-name> \
  --query id \
  --output tsv)

# Assign Key Vault Secrets User role to the managed identity
az role assignment create \
  --assignee "$PRINCIPAL_ID" \
  --role "Key Vault Secrets User" \
  --scope "$KV_ID"
```

---

### Step 5 — Configure Container App environment variables

Container Apps pulls Key Vault secrets at startup via `keyvaultref`. Non-sensitive values are set as plain env vars.

```bash
# Get the managed identity resource ID (needed for keyvaultref)
IDENTITY_ID=$(az containerapp show \
  --name containerapp-anmind \
  --resource-group rg-anmind-production \
  --query identity.id \
  --output tsv)

KV="https://<your-keyvault-name>.vault.azure.net/secrets"

# Register Key Vault-backed secrets on the Container App
az containerapp secret set \
  --name containerapp-anmind \
  --resource-group rg-anmind-production \
  --secrets \
    "database-url=keyvaultref:${KV}/database-url,identityref:${IDENTITY_ID}" \
    "jwt-secret=keyvaultref:${KV}/jwt-secret,identityref:${IDENTITY_ID}" \
    "redis-password=keyvaultref:${KV}/redis-password,identityref:${IDENTITY_ID}" \
    "mailer-pass=keyvaultref:${KV}/mailer-pass,identityref:${IDENTITY_ID}"

# Set all environment variables — sensitive ones reference the secrets above
az containerapp update \
  --name containerapp-anmind \
  --resource-group rg-anmind-production \
  --set-env-vars \
    PORT=3000 \
    DATABASE_URL=secretref:database-url \
    JWT_SECRET=secretref:jwt-secret \
    REDIS_HOST=<your-redis-cloud-host> \
    REDIS_PORT=<your-redis-cloud-port> \
    REDIS_USERNAME=default \
    REDIS_PASSWORD=secretref:redis-password \
    MAILER_HOST=<smtp-host> \
    MAILER_PORT=587 \
    MAILER_USER=<smtp-user> \
    MAILER_PASS=secretref:mailer-pass \
    MAILER_FROM=<from-address> \
    MAILER_FROM_NAME="Task App"
```

> **How `keyvaultref` works:** at container startup Azure fetches the secret value from Key Vault using the managed identity — no credential is stored in Container Apps configuration. If you rotate a Key Vault secret, restart the revision to pick up the new value.

---

### Step 6 — Create an App Registration for OIDC (GitHub Actions auth)

```bash
# Create the App Registration
az ad app create --display-name github-actions-deploy

# Note the appId from the output, then create a service principal
az ad sp create --id <appId>

# Assign AcrPush so the workflow can push Docker images
az role assignment create \
  --assignee <appId> \
  --role AcrPush \
  --scope $(az acr show --name <your-acr-name> --query id -o tsv)

# Assign Contributor on the resource group so the workflow can update the Container App
az role assignment create \
  --assignee <appId> \
  --role Contributor \
  --scope $(az group show --name rg-anmind-production --query id -o tsv)
```

Then in the Azure Portal, go to the App Registration → **Certificates & secrets → Federated credentials → Add credential**:

- Scenario: **GitHub Actions deploying Azure resources**
- Organization: your GitHub username
- Repository: your repo name
- Entity: **Branch**, value: `main`

Copy the **Application (client) ID**, **Tenant ID**, and your **Subscription ID** into GitHub secrets as shown in the CI/CD section.

---

### Step 7 — Push to main

```bash
git push origin main
```

The `deploy.yml` workflow runs automatically. Watch it under the **Actions** tab. When it finishes the Container App URL is your live API.

To find your URL at any time:

```bash
az containerapp show \
  --name containerapp-anmind \
  --resource-group rg-anmind-production \
  --query properties.configuration.ingress.fqdn \
  --output tsv
```

---

## Project Structure

```
.
├── .github/
│   ├── actions/
│   │   └── setup-node/          # Reusable composite action for Node setup
│   └── workflows/
│       ├── pr.yml               # PR checks: lint, test, docker build
│       ├── deploy.yml           # Push to main: build, push, deploy
│       ├── _lint.yml            # Reusable lint workflow
│       ├── _test.yml            # Reusable test workflow
│       ├── _docker-build.yml    # Reusable Docker build (no push)
│       ├── _docker-push.yml     # Reusable Docker push to ACR
│       └── _deploy.yml          # Reusable Container Apps deploy
│
└── app/
    ├── Dockerfile               # Multi-stage: dev → build → production
    ├── prisma/
    │   └── schema.prisma        # Database schema (User, Task)
    └── src/
        ├── main.ts              # Bootstrap: global filter, validation pipe, Swagger
        ├── app.module.ts        # Root module — wires all feature modules
        ├── auth/
        │   ├── auth.module.ts
        │   ├── auth.controller.ts   # POST /auth/login, /register, GET /profile
        │   ├── auth.service.ts      # bcrypt, JWT signing, user lookup
        │   ├── jwt.strategy.ts      # Passport strategy — validates JWT, populates request.user
        │   ├── guards/
        │   │   └── jwt-auth.guard.ts
        │   └── decorators/
        │       └── current-user.decorator.ts  # @CurrentUser() param decorator
        ├── task/
        │   ├── task.module.ts
        │   ├── task.controller.ts   # CRUD routes for /tasks
        │   ├── task.service.ts      # Business logic, ownership checks
        │   └── dto/
        │       ├── create-task.dto.ts
        │       ├── update-task.dto.ts
        │       └── retrieve-task.dto.ts
        ├── queue/
        │   ├── queue.module.ts
        │   ├── queue.service.ts     # Enqueues email jobs, schedules expiration cron
        │   ├── queue.consumer.ts    # BullMQ worker — processes email jobs
        │   └── task-expiration.consumer.ts
        ├── email/
        │   ├── email.module.ts
        │   └── email.service.ts     # Sends email via SMTP (Nodemailer)
        ├── prisma/
        │   └── prisma.service.ts    # PrismaClient wrapper, connects on init
        └── common/
            └── filters/
                └── http-exception.filter.ts  # Global exception filter
```

