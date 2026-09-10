# Codebase Map

The repository has no root `package.json`; run npm commands from `backend/` or `frontend/`.

## Backend

| File | Responsibility | Depends On | Used By |
|---|---|---|---|
| `backend/src/server.js` | Express entry point, global middleware, route registration, startup | Express, CORS, dotenv, route modules, error middleware | Node/npm `dev` script |
| `backend/src/routes/house.routes.js` | House CRUD routes and house-body validation | Express, house controller, `validate`, `createHouseSchema` | `server.js` |
| `backend/src/routes/dailyRecord.routes.js` | Daily-record CRUD routes and body validation | Express, daily-record controller, `validate`, record schemas | `server.js` |
| `backend/src/routes/dashboard.routes.js` | House dashboard route | Express, dashboard controller | `server.js` |
| `backend/src/controllers/house.controller.js` | House HTTP handlers and bird-count rule | Prisma client | `house.routes.js` |
| `backend/src/controllers/dailyRecord.controller.js` | Record HTTP handlers, mortality and duplicate handling | Prisma client | `dailyRecord.routes.js` |
| `backend/src/controllers/dashboard.controller.js` | Dashboard HTTP wrapper and 404 response | Dashboard service | `dashboard.routes.js` |
| `backend/src/services/dashboard.service.js` | Retrieves a house and calculates aggregate statistics | Prisma client | `dashboard.controller.js` |
| `backend/src/middleware/validate.js` | Applies a Zod schema to `req.body` | Zod schema interface | House and record routes |
| `backend/src/middleware/validation.schemas.js` | Active house and daily-record schemas | Zod | Route validation middleware |
| `backend/src/middleware/error.middleware.js` | Logs unexpected errors and returns generic 500 JSON | Express middleware contract | `server.js` |
| `backend/src/lib/prisma.js` | Creates and exports the shared Prisma client | `@prisma/client` | Controllers and dashboard service |
| `backend/prisma/schema.prisma` | Models, relation, defaults, unique constraint | `DATABASE_URL` | Prisma CLI/client |
| `backend/prisma/migrations/20260908220000_init/migration.sql` | Creates initial tables and cascade foreign key | PostgreSQL | Prisma migration engine |
| `backend/prisma/migrations/20260909220151_add_unique_daily_record_date/migration.sql` | Adds house/date uniqueness | PostgreSQL | Prisma migration engine |
| `backend/package.json` | Backend scripts and dependencies | npm | Developers/CI |

## Frontend

| File | Responsibility | Depends On | Used By |
|---|---|---|---|
| `frontend/src/main.jsx` | React entry point and Strict Mode bootstrap | React, `App` | Vite entry |
| `frontend/src/App.jsx` | Main dashboard state and CRUD orchestration | React hooks, API service, form/dialog components | `main.jsx` |
| `frontend/src/services/api.js` | Fetch wrapper and endpoint functions | Browser `fetch` | App and form components |
| `frontend/src/components/HouseForm.jsx` | Create-house form and client-side required-field checks | React, API service | `App.jsx` |
| `frontend/src/components/HouseEditForm.jsx` | Edit-house form | React, API service | `App.jsx` |
| `frontend/src/components/DailyRecordForm.jsx` | Create-record form | React, API service | `App.jsx` |
| `frontend/src/components/DailyRecordEditForm.jsx` | Edit-record form | React, API service | `App.jsx` |
| `frontend/src/components/ConfirmDialog.jsx` | Shared confirmation UI | React-compatible props only | `App.jsx` |
| `frontend/src/App.css` | Dashboard and component styles | CSS | `App.jsx` |
| `frontend/src/index.css` | Global/reset styles | CSS | `main.jsx` |
| `frontend/package.json` | Vite scripts and React dependencies | npm | Developers/CI |

## Dependency Direction

```text
server.js
  -> routes
     -> validation middleware + schemas
     -> controllers
        -> Prisma client
        -> dashboard service -> Prisma client

App.jsx
  -> services/api.js -> HTTP API
  -> components -> services/api.js
```