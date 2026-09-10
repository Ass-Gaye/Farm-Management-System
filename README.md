# Farm Management System

A poultry farm management system with a React/Vite dashboard and an Express API backed by PostgreSQL and Prisma.

## Project Status

The backend provides poultry-house, daily-record, dashboard, and health-check endpoints. The frontend is connected to the API and provides house selection, dashboard statistics, forms, daily-record management, loading states, and confirmation dialogs.

## Features

- Create and list poultry houses.
- View a poultry house together with its daily records.
- Add and list daily records for a poultry house.
- Calculate dashboard totals for current birds, mortality, feed used, and eggs collected.
- Run the backend against PostgreSQL through Prisma migrations.
- Develop the frontend with Vite hot module replacement.
- Validate request bodies with reusable Zod schemas.
- Enforce mortality, uniqueness, and cascade-deletion rules.

## Architecture

```text
.
|-- backend/
|   |-- prisma/
|   |   |-- migrations/
|   |   `-- schema.prisma
|   `-- src/
|       |-- controllers/
|       |-- lib/prisma.js
|       |-- middleware/
|       |-- routes/
|       |-- services/
|       `-- server.js
|-- frontend/
|   `-- src/
|       |-- App.jsx
|       |-- components/
|       |-- services/api.js
|       `-- main.jsx
|-- docs/
|   |-- architecture.md
|   |-- api.md
|   |-- codebase-map.md
|   |-- request-flow.md
|   |-- environment.md
|   `-- adding-features.md
|-- CONTRIBUTING.md
`-- README.md
```

## Requirements

- Node.js 18 or newer
- npm
- PostgreSQL 13 or newer

## Setup

Clone the repository and install dependencies in each application:

```bash
git clone https://github.com/Ass-Gaye/Farm-Management-System.git
cd Farm-Management-System

cd backend
npm install

cd ../frontend
npm install
```

### Configure the database

Create a PostgreSQL database, copy `backend/.env.example` to `backend/.env`, and replace the database placeholders:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/farm_management?schema=public"
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

Replace `USER`, `PASSWORD`, host, port, and database name with the values for your local PostgreSQL installation. Do not commit `.env`; environment files are ignored by Git.

Apply the existing migration and generate the Prisma client:

```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

For a production deployment, use `npx prisma migrate deploy` instead of `migrate dev`.

## Running the applications

Start the API in one terminal:

```bash
cd backend
npm run dev
```

The API runs at `http://localhost:5000` by default. Set `PORT` in `backend/.env` to use another port.

Start the frontend in another terminal:

```bash
cd frontend
npm run dev
```

Vite prints the local frontend URL, normally `http://localhost:5173`.

For a production server process, run `npm start` from `backend/`. Set `NODE_ENV=production` and configure `CORS_ORIGIN` before deployment. The backend also supports `npm run dev` for local development.

## API Reference

All successful responses use a JSON object with a `success` property. IDs are integers and dates are ISO-8601 date-time values.

### Health check

```http
GET /api/health
```

Example response:

```json
{
  "success": true,
  "message": "Poultry Management API is running"
}
```

### Poultry houses

```http
POST /api/houses
Content-Type: application/json
```

Request body:

```json
{
  "name": "House A",
  "birdsPlaced": 500,
  "createdAt": "2026-09-09T00:00:00.000Z"
}
```

List houses:

```http
GET /api/houses
```

Get one house and its records:

```http
GET /api/houses/:id
```

### Daily records

Daily records use flat routes under `/api/daily-records`.

Create a record:

```http
POST /api/daily-records
Content-Type: application/json
```

Request body:

```json
{
  "date": "2026-09-09T00:00:00.000Z",
  "mortality": 2,
  "feedUsedKg": 38.5,
  "eggsCollected": 420
}
```

List all records:

```http
GET /api/daily-records
```

Records are returned newest first and include their related house. The frontend filters this global list for the selected house.

Get, update, or delete one record with `GET`, `PUT`, or `DELETE /api/daily-records/:id`.

### House dashboard

```http
GET /api/houses/:houseId/dashboard
```

The response contains the house summary and these calculated statistics:

```json
{
  "success": true,
  "data": {
    "house": {
      "id": 1,
      "name": "House A",
      "birdsPlaced": 500,
      "createdAt": "2026-09-09T00:00:00.000Z"
    },
    "statistics": {
      "currentBirds": 498,
      "totalMortality": 2,
      "totalFeedUsed": 38.5,
      "totalEggsCollected": 420
    }
  }
}
```

`currentBirds` is calculated as `birdsPlaced - totalMortality`. Dashboard totals include every daily record belonging to the selected house.

## Database Model

### `PoultryHouse`

- `id`: auto-incrementing primary key
- `name`: house name
- `birdsPlaced`: number of birds placed initially
- `createdAt`: creation timestamp
- `dailyRecords`: related daily records

### `DailyRecord`

- `id`: auto-incrementing primary key
- `houseId`: foreign key to `PoultryHouse`
- `date`: date represented by the record
- `mortality`: number of birds lost, default `0`
- `feedUsedKg`: feed used in kilograms, default `0`
- `eggsCollected`: number of eggs collected, default `0`
- `createdAt`: record creation timestamp

Deleting a poultry house cascades to its daily records.

## Useful Commands

Backend:

```bash
cd backend
npm run dev                 # Start the API with nodemon
npx prisma studio           # Browse the database in Prisma Studio
npx prisma validate         # Validate the Prisma schema
```

Frontend:

```bash
cd frontend
npm run dev                 # Start the Vite development server
npm run build               # Create a production build
npm run lint                # Run ESLint
npm run preview             # Preview the production build
```

## Current Limitations

- The API currently has no authentication or authorization.
- The frontend API URL is configurable with `VITE_API_URL` but defaults to `http://localhost:5000/api`.
- Daily records are fetched globally and filtered in the frontend.

## Further Documentation

- [Architecture](docs/architecture.md): actual layers, request lifecycle, and design rationale.
- [API reference](docs/api.md): every current endpoint, body, rule, and response.
- [Codebase map](docs/codebase-map.md): file responsibilities and dependencies.
- [Request flow](docs/request-flow.md): a concrete `POST /api/houses` walkthrough.
- [Environment](docs/environment.md): configuration without secrets.
- [Adding features](docs/adding-features.md): step-by-step development guide.
- [Contributing](CONTRIBUTING.md): workflow, conventions, and verification.

## License

This project is distributed under the MIT License. See [LICENSE](LICENSE).