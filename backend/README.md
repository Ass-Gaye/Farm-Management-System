# Poultry Management System — Backend API

This directory contains the Express REST API and PostgreSQL / Prisma ORM service for the Poultry Management System.

## Overview

The backend provides secure, multi-tenant poultry farm management APIs:
- **Authentication:** JWT issuance and verification with bcrypt password hashing.
- **Tenant Isolation:** Enforces strict user ownership across all models: `PoultryHouse`, `DailyRecord`, `Breed`, `BirdCondition`, and `SlaughterPlan`.
- **Validation:** Request validation using Zod schemas with custom business rule checks (capacity bounds, date logic, non-negative whole numbers).
- **Dynamic Status Computation:** Dynamic slaughter status calculation (`Upcoming`, `Due soon`, `Due today`, `Overdue`, `Completed`).
- **Cascade Deletion:** Safely removes children data when a poultry house is deleted.
- **Automated Integration Testing:** Comprehensive end-to-end lifecycle test suite running against PostgreSQL using Node.js built-in test runner.

## Directory Structure

```text
backend/
|-- prisma/
|   |-- migrations/
|   |   |-- 20260909000000_init/
|   |   |-- 20260910000000_add_cascade_delete/
|   |   `-- 20260916225500_add_users_breeds_health_slaughter/
|   `-- schema.prisma
|-- src/
|   |-- controllers/
|   |   |-- auth.controller.js            # User registration, login, profile
|   |   |-- birdCondition.controller.js    # Health & condition check CRUD + validation
|   |   |-- breed.controller.js            # Breed CRUD + house scoping
|   |   |-- dailyRecord.controller.js      # Daily production logging
|   |   |-- dashboard.controller.js        # Aggregated statistics
|   |   |-- house.controller.js            # Scoped poultry house management
|   |   `-- slaughterPlan.controller.js    # Harvest scheduling & status computation
|   |-- lib/
|   |   `-- prisma.js                      # Prisma client singleton
|   |-- middleware/
|   |   |-- auth.middleware.js             # JWT bearer verification guard
|   |   |-- error.middleware.js            # Central error handler
|   |   |-- validate.js                    # Zod validation middleware
|   |   `-- validation.schemas.js          # Zod schemas for all endpoints
|   |-- routes/
|   |   |-- auth.routes.js                 # /api/auth routes
|   |   |-- birdCondition.routes.js        # /api/bird-conditions routes
|   |   |-- breed.routes.js                # /api/breeds routes
|   |   |-- dailyRecord.routes.js          # /api/daily-records routes
|   |   |-- dashboard.routes.js            # /api/houses/:id/dashboard routes
|   |   |-- house.routes.js                # /api/houses routes
|   |   `-- slaughterPlan.routes.js        # /api/slaughter-plans routes
|   |-- services/
|   |   `-- dashboard.service.js           # Multi-entity aggregation service
|   `-- server.js                          # Express application initialization
|-- test/
|   `-- api.test.js                        # Integration tests for auth, isolation & CRUD
|-- .env.example
|-- package.json
`-- README.md
```

## Environment Configuration

Configure `backend/.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="7d"
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

## Available Scripts

Run from the `backend/` directory:

```bash
# Install dependencies
npm install

# Start development server with hot-reload (nodemon)
npm run dev

# Start production server
npm start

# Run automated integration tests
npm test

# Prisma database tools
npx prisma migrate dev      # Create and apply migrations in development
npx prisma migrate deploy   # Apply pending migrations in production
npx prisma generate         # Regenerate Prisma Client
npx prisma studio           # Open Prisma Studio web database browser
```

## Running Tests

The test suite in `test/api.test.js` runs against your PostgreSQL database:

```bash
npm test
```

This verifies:
1. Public health check (`GET /api/health`).
2. Authentication rejection for unauthenticated requests (`401`).
3. User registration and JWT login flow.
4. Tenant isolation (User 2 cannot view, edit, or delete User 1's house or records).
5. Duplicate date prevention on daily records.
6. Mortality boundary checks against placed birds.
7. Breed CRUD and house scoping.
8. Health condition count validation against available birds.
9. Slaughter date validation (`expectedSlaughterDate >= placementDate`).
10. Slaughter status computation and completion toggle (`PATCH /:id/complete`).
11. Dashboard aggregation calculations.
12. Cascade deletion and clean-up.
