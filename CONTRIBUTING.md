# Contributing

## Project Architecture

The repository contains separate `backend/` and `frontend/` applications. The backend receives HTTP requests through Express, validates request bodies with Zod, handles HTTP behavior in controllers, uses a service for dashboard aggregation, and accesses PostgreSQL through Prisma. The frontend calls the API through `frontend/src/services/api.js` and renders the dashboard through React components.

Read [docs/architecture.md](docs/architecture.md) before changing cross-cutting behavior.

## Where Code Belongs

- Routes: HTTP method, path, middleware, and controller wiring in `backend/src/routes/`.
- Controllers: request data, status codes, response envelopes, and resource-specific rules in `backend/src/controllers/`.
- Services: reusable calculations or domain operations that do not need Express objects in `backend/src/services/`.
- Validation: Zod schemas in `backend/src/middleware/validation.schemas.js`, applied with `validate.js`.
- Database access: Prisma models in `backend/prisma/schema.prisma`; runtime queries through `src/lib/prisma.js`.
- Frontend API calls: `frontend/src/services/api.js`.
- Frontend UI: reusable forms/dialogs in `frontend/src/components/`; application orchestration in `frontend/src/App.jsx`.

## Naming and Style

- Use descriptive verbs such as `createHouse`, `getDailyRecords`, and `deleteDailyRecord`.
- Keep CommonJS in the backend and ES modules in the frontend.
- Preserve the existing response shape: `success`, optional `message`, and optional `data`.
- Comments should explain business rules or architectural reasons, not obvious syntax.
- Add focused JSDoc to exported controllers and services.

## Adding a New Feature

For a new feature such as Feed Purchase:

1. Update the Prisma schema.
2. Create and inspect a migration.
3. Add a Zod validation schema.
4. Create a service if calculations or reusable domain logic are needed.
5. Create controller handlers.
6. Create routes and register them in `server.js`.
7. Add frontend API calls and UI if applicable.
8. Document the endpoint, data model, and request flow.
9. Test success and failure paths.

See [docs/adding-features.md](docs/adding-features.md) for the detailed checklist.

## Database Changes

Run Prisma commands from `backend/`:

```bash
npx prisma migrate dev --name describe_change
npx prisma generate
npx prisma validate
```

Do not edit an applied migration to change history. Create a new migration instead.

## Error Handling

Return known validation, not-found, conflict, and business-rule errors directly from the controller with the established JSON shape. Pass unexpected errors to `next(error)` so the centralized middleware can log them and return the generic response. Do not expose stack traces or secrets.

## Documentation

Update the relevant documentation when behavior changes:

- `README.md`: onboarding and high-level project information.
- `docs/api.md`: endpoint contract.
- `docs/architecture.md`: boundaries and reasoning.
- `docs/codebase-map.md`: file relationships.
- `docs/environment.md`: configuration.

## Verification

Run commands from the application directory that owns the script:

```bash
cd backend
npx prisma validate
npm test

cd ../frontend
npm run lint
npm run build
```

The backend test command runs the integration suite in `backend/test/api.test.js` and requires a working PostgreSQL connection. For API changes, run the development server and exercise additional endpoint scenarios with temporary data, then clean it up.