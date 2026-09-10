# Environment Variables

The backend reads `DATABASE_URL`, `PORT`, `NODE_ENV`, and `CORS_ORIGIN`. The frontend reads `VITE_API_URL` through Vite.

## `DATABASE_URL`

- Required: yes.
- Used by: Prisma datasource in `backend/prisma/schema.prisma`.
- Loaded by: `require("dotenv").config()` in `backend/src/server.js` and Prisma CLI commands.
- Example:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/farm_management?schema=public"
```

Never commit a real connection string. Store it in `backend/.env`, which is ignored by Git.

## `PORT`

- Required: no.
- Used by: `backend/src/server.js`.
- Default: `5000`.
- Example:

```env
PORT=5000
```

## `NODE_ENV`

- Required: no.
- Used by: `backend/src/server.js` to apply restrictive production CORS behavior.
- Example:

```env
NODE_ENV=production
```

When `NODE_ENV=production`, cross-origin requests are denied unless `CORS_ORIGIN` explicitly allows their origin.

## `CORS_ORIGIN`

- Required: no in local development; recommended in production.
- Used by: `backend/src/server.js`.
- Purpose: comma-separated list of allowed browser origins.
- Example:

```env
CORS_ORIGIN=https://farm.example.com
```

Multiple origins may be separated with commas.

## `VITE_API_URL`

- Required: no.
- Used by: `frontend/src/services/api.js`.
- Default: `http://localhost:5000/api`.
- Example:

```env
VITE_API_URL=http://localhost:5000/api
```

Copy `frontend/.env.example` to a local `.env` file when a different API origin is needed.

## Setup

Copy `backend/.env.example` to `backend/.env`, replace the database placeholders, then run migrations from `backend/`:

```bash
npx prisma migrate dev
npx prisma generate
```