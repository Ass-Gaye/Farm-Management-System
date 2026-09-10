# Adding Features

This guide follows the current Express, Zod, Prisma, and React structure without adding a new architectural layer.

## Add a New CRUD Resource

For a resource such as `FeedPurchase`:

1. Add the Prisma model and relation in `backend/prisma/schema.prisma`.
2. Run `npx prisma migrate dev --name add_feed_purchase` from `backend/`.
3. Add create/update Zod schemas to `src/middleware/validation.schemas.js`.
4. Add a controller with HTTP-focused handlers.
5. Add a route module that connects methods, validation, and controllers.
6. Mount the route module in `src/server.js`.
7. Add API functions in `frontend/src/services/api.js` if the frontend needs the resource.
8. Add or update React components and state orchestration.
9. Document endpoints in `docs/api.md` and dependencies in `docs/codebase-map.md`.
10. Test success, validation, not-found, and database-conflict paths.

## Add a Single Endpoint

1. Decide the URL and response envelope.
2. Add the controller function.
3. Add the route declaration in the owning route file.
4. Attach a Zod schema if a body needs validation.
5. Mount a new route module in `server.js` only if this is a new resource.
6. Add a frontend API function when applicable.
7. Add the endpoint to `docs/api.md`.

Routes should contain method, path, middleware, and controller references. Business logic belongs in a controller or service, not inside the route callback.

## Add Validation

1. Define a Zod object in `backend/src/middleware/validation.schemas.js`.
2. Attach it with `validate(schema)` in the route.
3. Assume the controller receives `req.body` after Zod parsing.
4. Document required types and error behavior in `docs/api.md`.

The separate `backend/src/validators/` files are currently unused placeholders. Do not add a second validation system without first deciding to replace the active middleware approach.

## Add a Service

Create a service when logic is reusable, aggregates multiple records, or would make a controller difficult to read. Services should accept domain values, use Prisma where needed, and return data or `null`; they should not depend on `req`, `res`, or Express status codes.

The dashboard service is the existing example: it loads a house and calculates aggregate statistics for the dashboard controller.

## Add a Dashboard Calculation

1. Identify the source fields in the Prisma models.
2. Add the calculation in `backend/src/services/dashboard.service.js`.
3. Include the value in the `statistics` response object.
4. Add its meaning and formula to `docs/api.md`.
5. Render it in the matching stat card in `frontend/src/App.jsx`.
6. Format units and decimals in the UI consistently with existing cards.

## Add a Database Model

1. Add the model and relations in `schema.prisma`.
2. Add constraints and defaults only when they represent real domain rules.
3. Create and inspect a migration.
4. Run `npx prisma validate` and `npx prisma generate`.
5. Add controller/service access through the shared Prisma client.
6. Test cascade and uniqueness behavior where relevant.

## Verification Checklist

From `backend/`:

```bash
npx prisma validate
npm test
```

`npm test` runs the sequential API integration test in `backend/test/api.test.js`. It requires a working PostgreSQL `DATABASE_URL`.

From `frontend/`:

```bash
npm run lint
npm run build
```

For API work, start the backend with `npm run dev` and exercise the endpoint with a temporary record. Clean up test data afterward.