# Architecture

## Overview

Farm Management System is a small two-application repository:

- `backend/` provides an Express HTTP API.
- `frontend/` provides the React/Vite dashboard.
- PostgreSQL stores application data through Prisma.

The backend uses a deliberately simple layered flow. Routes define HTTP paths, validation middleware checks request bodies, controllers handle HTTP concerns and business rules, and Prisma performs database access. The dashboard service contains reusable aggregation logic because those calculations are more than simple response formatting.

```text
React dashboard
      |
      | fetch JSON
      v
Express server (backend/src/server.js)
      |
      v
Route module
      |
      v
Zod validation middleware (where configured)
      |
      v
Controller
      |
      +--> Dashboard service (dashboard endpoint)
      |
      v
Prisma client (src/lib/prisma.js)
      |
      v
PostgreSQL
```

There is no authentication or authorization layer in the current application. CORS is open during development, while production requires the configured `CORS_ORIGIN` allowlist.

## Request Lifecycle

For a request such as `POST /api/houses`:

1. The browser or another client sends JSON to port `5000`.
2. Express receives the request in `server.js`.
3. `express.json()` parses the body and CORS middleware adds the configured headers.
4. Express selects the `/api/houses` route module.
5. The route runs `validate(createHouseSchema)` before the controller.
6. Zod checks the body. On success, the middleware replaces `req.body` with parsed data.
7. `createHouse` reads the parsed body and calls Prisma.
8. Prisma sends the insert to PostgreSQL using `DATABASE_URL`.
9. The controller returns a `201` JSON response.
10. Any error passed to `next(error)` reaches the final error middleware.

The frontend uses the same API client for forms, house selection, dashboard loading, and daily-record actions. When a house is selected, `App.jsx` requests its dashboard and the global daily-record list in parallel, then filters records by `houseId` in the browser.

## Folder Responsibilities

### Backend

- `src/server.js`: Express entry point, global middleware, route registration, and HTTP startup.
- `src/routes/`: HTTP method/path definitions and route-level validation wiring.
- `src/controllers/`: request parsing, response formatting, status codes, database calls, and current resource business rules.
- `src/services/`: reusable domain calculations that should not depend on Express request/response objects.
- `src/middleware/validate.js`: adapter that applies a Zod schema to `req.body`.
- `src/middleware/validation.schemas.js`: active Zod request schemas.
- `src/middleware/error.middleware.js`: final fallback for unexpected errors.
- `src/lib/prisma.js`: one shared Prisma client instance.
- `prisma/schema.prisma`: models, relations, defaults, and constraints.
- `prisma/migrations/`: versioned database changes generated from schema changes.

### Frontend

- `src/main.jsx`: React bootstrap and Strict Mode setup.
- `src/App.jsx`: dashboard state and orchestration for house and record workflows.
- `src/components/`: forms and reusable confirmation dialog UI.
- `src/services/api.js`: JSON fetch wrapper and endpoint-specific client functions.
- `src/App.css` and `src/index.css`: dashboard and global styles.

## Why These Boundaries Exist

### Routes versus controllers

Routes are kept small so a reader can see the public API surface in one place. Controllers are the appropriate place for HTTP-specific details such as `req`, `res`, status codes, and response envelopes. Putting database or business logic in route declarations would make route files harder to scan and reuse.

### Validation before controllers

Validation rejects malformed input before it reaches database code. This keeps controllers focused on valid application data and gives clients a consistent `400` response with field-level errors. `validate.js` also assigns Zod's parsed result back to `req.body`, so downstream code receives coerced dates rather than the original unparsed values.

### Controllers versus services

The current controllers still perform resource-specific Prisma operations and rules. The dashboard calculation is in `dashboard.service.js` because it combines several records into reusable statistics and does not need Express objects. A new service should be introduced when logic is reused or becomes difficult to understand in a controller, not merely to add another layer.

### Prisma isolation

`src/lib/prisma.js` creates the shared `PrismaClient` in one place. Controllers and services import that module instead of constructing separate clients, which keeps connection management predictable and avoids duplicated setup.

### Centralized error handling

Controllers call `next(error)` for unexpected failures. The final middleware logs the error server-side and returns a generic `500` response, preventing stack traces from being exposed to clients. Validation and known business failures are returned earlier with specific status codes.

### Why `server.js` stays small

`server.js` should wire the application together, not implement resource behavior. Keeping configuration, global middleware, routes, error handling, and startup there makes the entry point easy to inspect and keeps feature work in its owning module.

## Data Flow

```text
PoultryHouse 1 -------- * DailyRecord
     |                         |
     |                         +-- mortality
     |                         +-- feedUsedKg
     |                         +-- eggsCollected
     |
     +-- birdsPlaced

Dashboard statistics are derived from one house and all of its records:
currentBirds = birdsPlaced - sum(record.mortality)
```

House deletion cascades to its daily records at the database relationship level. A unique constraint prevents two records with the same exact `houseId` and `date`.

## Error and Validation Flow

```text
Invalid request body
        |
        v
Zod safeParse fails
        |
        v
400 { success, message, errors }

Known business/resource failure
        |
        v
Controller returns 400, 404, or 409

Unexpected exception
        |
        v
next(error) -> error.middleware.js -> 500 generic response
```

The current error middleware does not distinguish Prisma error types globally. Daily-record duplicate errors are handled locally in the daily-record controller because that endpoint has a specific `409` contract.

## Where New Functionality Belongs

1. Add or change a Prisma model in `backend/prisma/schema.prisma`.
2. Create a migration in `backend/prisma/migrations/`.
3. Add request rules to `backend/src/middleware/validation.schemas.js`.
4. Add reusable calculations to `backend/src/services/` when needed.
5. Add HTTP handlers to a controller.
6. Register methods and validation in a route module.
7. Mount a new route module in `backend/src/server.js`.
8. Add frontend API functions and components if the feature is user-facing.
9. Update `docs/api.md`, `docs/codebase-map.md`, and the README.

## Known Boundaries and Risks

- Route IDs are validated as positive integers by the route-parameter middleware.
- Daily records are fetched globally and filtered client-side.
- The frontend API base URL is configurable through `VITE_API_URL`.
- Mortality-sensitive record writes use serializable Prisma transactions with bounded retries.
- There is no authentication or authorization layer.