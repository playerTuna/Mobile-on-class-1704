# NestJS App Architecture Documentation

## Table of Contents
1. [Overview](#overview)
2. [Project Structure](#project-structure)
3. [Modules](#modules)
4. [Controllers](#controllers)
5. [Services](#services)
6. [DTOs (Data Transfer Objects)](#dtos)
7. [Queues & Job Processing](#queues--job-processing)
8. [Database & ORM](#database--orm)
9. [Authentication & Security](#authentication--security)
10. [Exception Handling](#exception-handling)
11. [API Endpoints](#api-endpoints)
12. [Configuration](#configuration)

---

## Overview

This is a **NestJS backend application** for task management with email notifications and scheduled job processing. The application implements:
- RESTful API with JWT authentication
- PostgreSQL database using Prisma ORM
- Redis-based job queue (BullMQ) for asynchronous operations
- Automatic task expiration notifications
- Email service integration (Nodemailer)
- Global exception handling with standardized error responses

**Technology Stack:**
- **Framework:** NestJS 11
- **Runtime:** Node.js
- **Database:** PostgreSQL with Prisma
- **Job Queue:** BullMQ + Redis
- **Email:** Nodemailer (@nestjs-modules/mailer)
- **Authentication:** JWT (Passport.js)
- **API Documentation:** Swagger/OpenAPI

---

## Project Structure

```
src/
├── app.module.ts                 # Root module
├── app.controller.ts             # App controller
├── app.service.ts                # App service
├── main.ts                        # Application entry point
│
├── auth/                          # Authentication module
│   ├── auth.module.ts
│   ├── auth.service.ts
│   ├── auth.controller.ts
│   ├── jwt.strategy.ts
│   ├── guards/
│   │   └── jwt-auth.guard.ts
│   ├── decorators/
│   │   └── current-user.decorator.ts
│   └── dto/
│       ├── login.dto.ts
│       ├── register.dto.ts
│       ├── auth-response.dto.ts
│       ├── token.dto.ts
│       └── user-info.dto.ts
│
├── email/                         # Email module
│   ├── email.module.ts
│   ├── email.service.ts
│   ├── email.controller.ts
│   └── dto/
│       └── send-email.dto.ts
│
├── queue/                         # Queue/Job processing module
│   ├── queue.module.ts
│   ├── queue.service.ts
│   ├── queue.consumer.ts
│   ├── task-expiration.consumer.ts
│   ├── queue.constants.ts
│   └── dto/
│       └── queue.dto.ts
│
├── task/                          # Task management module
│   ├── task.module.ts
│   ├── task.service.ts
│   ├── task.controller.ts
│   └── dto/
│       ├── create-task.dto.ts
│       ├── retrieve-task.dto.ts
│       └── update-task.dto.ts
│
├── prisma/                        # Database service
│   ├── prisma.module.ts
│   └── prisma.service.ts
│
├── filters/                       # Exception filters
│   └── http-exception.filter.ts
│
└── common/                        # Shared utilities
    └── logger.ts                  # Custom AppLogger
```

---

## Modules

### 1. **AppModule** (Root Module)
**File:** `app.module.ts`

**Imports:**
- ConfigModule (global)
- BullModule (global Redis/queue config)
- MailerModule (global email config)
- PrismaModule
- AuthModule
- TaskModule
- QueueModule

**Purpose:** Root module that bootstraps the entire application and configures global services.

**Configuration:**
```typescript
BullModule.forRoot({
  connection: { host: 'localhost', port: 6379 }
})

MailerModule.forRoot({
  transport: { host, port, auth },
  defaults: { from: MAILER_FROM }
})
```

---

### 2. **AuthModule**
**File:** `auth/auth.module.ts`

**Providers:**
- AuthService
- JwtStrategy

**Exports:**
- AuthService

**Purpose:** Handles user authentication, registration, and JWT token management.

---

### 3. **TaskModule**
**File:** `task/task.module.ts`

**Imports:**
- PrismaModule
- QueueModule

**Providers:**
- TaskService

**Controllers:**
- TaskController

**Purpose:** Manages task CRUD operations and integrates with queue for email notifications.

---

### 4. **EmailModule**
**File:** `email/email.module.ts`

**Providers:**
- EmailService

**Controllers:**
- EmailController

**Exports:**
- EmailService

**Purpose:** Provides email sending functionality using Nodemailer.

---

### 5. **QueueModule**
**File:** `queue/queue.module.ts`

**Imports:**
- PrismaModule
- EmailModule
- BullModule (registers EMAIL and TASK_EXPIRATION queues)

**Providers:**
- QueueService
- QueueConsumer (processes email jobs)
- TaskExpirationConsumer (processes task expiration checks)

**Exports:**
- QueueService

**Purpose:** Manages Redis job queues and background job processing.

---

### 6. **PrismaModule**
**File:** `prisma/prisma.module.ts`

**Providers:**
- PrismaService

**Exports:**
- PrismaService

**Purpose:** Provides database connection using Prisma ORM.

---

## Controllers

### 1. **AuthController**
**File:** `auth/auth.controller.ts`
**Base Route:** `/auth`

#### Endpoints:

| Method | Route | DTO | Response | Description |
|--------|-------|-----|----------|-------------|
| POST | `/register` | RegisterDto | AuthResponseDto | Register new user |
| POST | `/login` | LoginDto | AuthResponseDto | Login and get JWT token |

**Request Body Examples:**
```json
// Register
{
  "email": "user@example.com",
  "password": "SecurePass123"
}

// Login
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

---

### 2. **TaskController**
**File:** `task/task.controller.ts`
**Base Route:** `/tasks`
**Authentication:** Required (JWT)

#### Endpoints:

| Method | Route | DTO | Response | Description |
|--------|-------|-----|----------|-------------|
| GET | `/` | - | RetrieveTaskDto[] | Get all user tasks |
| POST | `/` | CreateTaskDto | RetrieveTaskDto | Create new task |
| PATCH | `/:id` | UpdateTaskDto | RetrieveTaskDto | Update task |
| DELETE | `/:id` | - | void | Delete task |

**Request Body Examples:**
```json
// Create Task
{
  "title": "Buy groceries",
  "description": "Milk, eggs, bread",
  "due_date": "2026-04-20T10:00:00Z"
}

// Update Task
{
  "title": "Updated title",
  "due_date": "2026-04-21T10:00:00Z"
}
```

---

### 3. **EmailController**
**File:** `email/email.controller.ts`
**Base Route:** `/email`

#### Endpoints:

| Method | Route | DTO | Response | Description |
|--------|-------|-----|----------|-------------|
| POST | `/send` | SendEmailDto | { success, message } | Send plain text email |
| POST | `/send-template` | SendEmailWithTemplateDto | { success, message } | Send templated email |

**Request Body Examples:**
```json
// Send Email
{
  "to": "user@example.com",
  "subject": "Welcome",
  "message": "Welcome to our app!"
}

// Send Template Email
{
  "to": "user@example.com",
  "subject": "Welcome",
  "template": "welcome",
  "context": { "name": "John" }
}
```

---

## Services

### 1. **AuthService**
**File:** `auth/auth.service.ts`

**Methods:**

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `register(dto)` | RegisterDto | AuthResponseDto | Create new user with hashed password |
| `login(dto)` | LoginDto | AuthResponseDto | Authenticate user and generate JWT |
| `validateUser(email)` | string | User \| null | Find user by email |

**Features:**
- Password hashing with bcrypt
- JWT token generation (expires in 24 hours)
- User validation and error handling

---

### 2. **TaskService**
**File:** `task/task.service.ts`

**Methods:**

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `findAll(user_id)` | string | RetrieveTaskDto[] | Get all tasks for user |
| `create(user_id, dto)` | string, CreateTaskDto | RetrieveTaskDto | Create new task and trigger email queue |
| `update(user_id, id, dto)` | string, string, UpdateTaskDto | RetrieveTaskDto | Update task |
| `remove(user_id, id)` | string, string | void | Delete task |

**Features:**
- User-specific task queries
- Email notification on task creation
- Access control (users can only modify their own tasks)

---

### 3. **EmailService**
**File:** `email/email.service.ts`

**Methods:**

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `sendEmail(data)` | SendEmailDto | void | Send plain text email via Nodemailer |
| `sendEmailWithTemplate(data)` | SendEmailWithTemplateDto | void | Send templated email with Handlebars |

**Features:**
- Email validation
- Error handling with logging
- SMTP configuration via environment variables

**Environment Variables Required:**
```env
MAILER_HOST=smtp.gmail.com
MAILER_PORT=587
MAILER_USER=your-email@gmail.com
MAILER_PASS=your-app-password
MAILER_FROM=noreply@yourapp.com
MAILER_FROM_NAME=Your App Name
```

---

### 4. **QueueService**
**File:** `queue/queue.service.ts`

**Methods:**

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `sendEmail(data)` | SendEmailDto | Job | Add email job to queue |
| `scheduleTaskExpirationCheck()` | - | void | Schedule recurring task expiration check |
| `onModuleInit()` | - | void | Initialize scheduler on app startup |

**Features:**
- Queues email jobs with retry logic (3 attempts)
- Schedules task expiration check every 1 minute
- Removes duplicate schedulers on restart

---

### 5. **PrismaService**
**File:** `prisma/prisma.service.ts`

**Methods:**

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `onModuleInit()` | - | Promise | Connect to database on app startup |

**Features:**
- PostgreSQL connection via PrismaPg adapter
- Connection pooling
- Auto-disconnect on app shutdown

---

## DTOs

### Auth DTOs
```typescript
// LoginDto
{ email: string; password: string }

// RegisterDto
{ email: string; password: string }

// AuthResponseDto
{
  access_token: string;
  user: UserInfoDto;
}

// UserInfoDto
{ id: string; email: string }
```

### Task DTOs
```typescript
// CreateTaskDto
{
  title: string;           // Required
  description?: string;    // Optional
  due_date?: Date;        // Optional
}

// UpdateTaskDto
{
  title?: string;
  description?: string;
  due_date?: Date;
}

// RetrieveTaskDto
{
  id: string;
  title: string;
  description: string;
  due_date: Date;
}
```

### Email DTOs
```typescript
// SendEmailDto
{
  to: string;      // Email address (validated)
  subject: string;
  message: string;
}

// SendEmailWithTemplateDto
{
  to: string;
  subject: string;
  template: string;       // Template file name
  context: Record<string, any>;
}
```

### Queue DTOs
```typescript
// EmailJobDto
{
  to: string;
  subject: string;
  message: string;
}

// TaskExpirationCheckResultDto
{
  sent: number;     // Successfully sent notifications
  failed: number;   // Failed notifications
  total: number;    // Total tasks found
}
```

---

## Queues & Job Processing

### Queue Architecture

**Redis Connection:**
- Host: `localhost` (configurable)
- Port: `6379`
- Job Storage: Redis (automatic persistence)

---

### 1. **Email Queue**
**Queue Name:** `email-queue`

**Job Type:** `send-email`

**Payload:**
```typescript
{
  to: string;
  subject: string;
  message: string;
}
```

**Processing:**
- Consumer: `QueueConsumer`
- Retry Policy: 3 attempts with exponential backoff (1s delay)
- Processing: Sequential (one worker)
- Logs: Job ID, recipient, completion status

**Flow:**
1. Task created → EmailService sends email job
2. Job added to queue with delay (3 seconds)
3. QueueConsumer picks up job
4. EmailService.sendEmail() called
5. Success → Job removed from queue
6. Failure → Retry (max 3 times)

---

### 2. **Task Expiration Queue**
**Queue Name:** `task-expiration-queue`

**Job Type:** `check-expiring-tasks`

**Schedule:** Every 1 minute (cron: `*/1 * * * *`)

**Processing:**
- Consumer: `TaskExpirationConsumer`
- Query: All tasks with `due_date` in next 3 days
- Action: Send email notification to task owner

**Payload:**
```typescript
{
  // Empty - no data needed
}
```

**Return Value:**
```typescript
{
  sent: number;      // Emails successfully queued
  failed: number;    // Failed email attempts
  total: number;     // Total tasks found
}
```

**Query Details:**
```typescript
WHERE due_date >= TODAY at 00:00:00
  AND due_date <= 3 DAYS FROM NOW at 23:59:59
```

**Email Sent:**
```
Subject: Task Expiration: {task.title}
Body: The task "{title}" is due to expire on {due_date}
```

**Flow:**
1. Scheduler triggers every 1 minute
2. Query tasks expiring in 3 days
3. For each task, queue email notification
4. Process emails in parallel (Promise.allSettled)
5. Log success/failure statistics

---

## Database & ORM

### Prisma Setup

**Configuration File:** `prisma/schema.prisma`

**Adapter:** PrismaPg (PostgreSQL)

**Connection String:** Via `DATABASE_URL` environment variable

**Generated Client Location:** `./generated/prisma/client`

### Database Schema

**User Table:**
```sql
model User {
  id        String    @id @default(cuid())
  email     String    @unique
  password  String    // Hashed with bcrypt
  tasks     Task[]
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt
}
```

**Task Table:**
```sql
model Task {
  id        String    @id @default(cuid())
  user_id   String
  user      User      @relation(fields: [user_id], references: [id])
  title     String
  description String?
  due_date  DateTime?
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt
}
```

---

## Authentication & Security

### JWT Authentication

**Strategy:** Passport JWT

**Token Details:**
- **Algorithm:** HS256
- **Secret:** Via `JWT_SECRET` environment variable
- **Expiration:** 24 hours (configurable)
- **Payload:** `{ sub: user.id, email: user.email }`

**Guard:** `JwtAuthGuard`
- Applied globally or per-route
- Validates token and extracts user
- Returns 401 if invalid/expired

**Decorator:** `@CurrentUser()`
- Extracts authenticated user from request
- Available in guards and controllers

### Security Features

1. **Password Hashing:** bcrypt (rounds: 10)
2. **JWT Validation:** Passport.js
3. **CORS:** Configurable
4. **Exception Filtering:** Global error handler
5. **Input Validation:** class-validator DTOs

---

## Exception Handling

### Global Exception Filter

**File:** `filters/http-exception.filter.ts`

**Applied:** Globally in `main.ts` via `app.useGlobalFilters()`

**Catches:** All `HttpException` errors

**Response Format:**
```json
{
  "statusCode": 400,
  "timestamp": "2026-04-16T12:15:01.234Z",
  "path": "/api/endpoint",
  "method": "POST",
  "message": "Error description"
}
```

**Exception Mapping:**
- 400: BadRequestException (validation errors)
- 401: UnauthorizedException (missing/invalid token)
- 403: ForbiddenException (access denied)
- 404: NotFoundException (resource not found)
- 500: InternalServerErrorException (server errors)

---

## Logging

### Custom Logger

**File:** `common/logger.ts`

**Class:** `AppLogger extends Logger`

**Features:**
- Structured logging with context objects
- Consistent formatting: `message [key=value key=value]`
- Log levels: `log`, `debug`, `warn`, `error`
- Query-friendly format for grep/filtering

**Usage:**
```typescript
this.logger.log('Email sent', { 
  to: 'user@example.com', 
  subject: 'Welcome' 
});
// Output: Email sent [to=user@example.com subject=Welcome]

this.logger.error('Failed to send', error, { 
  jobId: '123', 
  to: 'user@example.com' 
});
```

---

## API Endpoints

### Summary

```
BASE_URL: http://localhost:3000

AUTH ENDPOINTS:
  POST   /auth/register          - Register new user
  POST   /auth/login             - Login and get JWT

TASK ENDPOINTS (requires JWT):
  GET    /tasks                  - Get all tasks
  POST   /tasks                  - Create task
  PATCH  /tasks/:id              - Update task
  DELETE /tasks/:id              - Delete task

EMAIL ENDPOINTS:
  POST   /email/send             - Send text email
  POST   /email/send-template    - Send templated email

SWAGGER:
  GET    /api-docs               - OpenAPI documentation
```

---

## Configuration

### Environment Variables

```env
# App
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/taskdb

# JWT
JWT_SECRET=your-secret-key-here

# Email (Nodemailer)
MAILER_HOST=smtp.gmail.com
MAILER_PORT=587
MAILER_USER=your-email@gmail.com
MAILER_PASS=your-app-password
MAILER_FROM=noreply@yourapp.com
MAILER_FROM_NAME=Your App Name

# Redis (BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## Running the Application

### Installation
```bash
npm install
npx prisma generate
npx prisma migrate dev
```

### Development
```bash
npm run start:dev
```

### Production
```bash
npm run build
npm run start:prod
```

### Testing
```bash
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm run test:cov           # With coverage
```

---

## Key Features Summary

✅ User authentication with JWT
✅ Task CRUD with user isolation
✅ Email service integration
✅ Redis-based job queues
✅ Automatic task expiration notifications (every 1 minute)
✅ PostgreSQL database with Prisma ORM
✅ Global exception handling
✅ Structured logging
✅ Input validation with DTOs
✅ Swagger API documentation

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Client                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     NestJS Application                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Express Router + Global Pipes & Filters             │   │
│  └──────────────────────────────────────────────────────┘   │
│       ▲                                                     │
│       │                                                     │
│  ┌────┴────────┬──────────────┬──────────────┐              │
│  │             │              │              │              │
│  ▼             ▼              ▼              ▼              │
│ AuthModule  TaskModule    EmailModule    QueueModule        │
│  │             │              │              │              │
│  ├─Controller  ├─Controller   ├─Controller   ├─Service      │
│  ├─Service     ├─Service      ├─Service      ├─Consumers(2) │
│  └─Guards      └─DTOs         └─DTOs         └─DTOs         │
│      │             │              │              │          │
│      └─────────────┴──────────────┴──────────────┘          │
│                     │                                       │
│                     ▼                                       │
│            ┌──────────────────┐                             │
│            │  PrismaService   │                             │
│            │  (PostgreSQL)    │                             │
│            └──────────────────┘                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
        │                                      │
        ▼                                      ▼
┌──────────────────┐                  ┌──────────────────┐
│   PostgreSQL     │                  │   Redis + BullMQ │
│   Database       │                  │   Job Queue      │
└──────────────────┘                  └──────────────────┘
```

---

## Contact & Support

For questions or issues, please refer to the inline code comments and test files.
