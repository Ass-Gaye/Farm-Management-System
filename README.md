# Farm Management System

A production-grade poultry farm management platform featuring a React 19 + Vite dashboard and an Express REST API backed by PostgreSQL and Prisma ORM.

## Project Status

The platform features multi-user isolation with JWT authentication, user-specific poultry houses, breed cataloging, flock health condition tracking, harvest & slaughter date planning, daily production records, and live dashboard analytics.

## Key Features

### 1. User Authentication & Data Isolation
- **JWT-based Security:** User registration, login, and `/me` endpoints using JSON Web Tokens and bcrypt password hashing.
- **Tenant Isolation:** Every poultry house, breed, daily record, health check, and slaughter plan is strictly scoped to the authenticated user on the database query level. Users cannot access, edit, or delete another user's data.

### 2. Poultry House Management
- Create, view, edit, and delete poultry houses.
- House selection dropdown filtered exclusively to the authenticated user.
- Cascade deletion: Deleting a house safely removes all associated daily records, breeds, health inspections, and slaughter plans.

### 3. Bird Breed Management
- Record multiple breeds kept within each poultry house (e.g., Cobb 500, Ross 308, Lohmann Brown).
- Track breed name, flock count, date added, and notes/purpose.
- Input validation ensuring positive bird counts and required breed names.
- Breeds summary displayed on the dashboard with total cataloged birds.

### 4. Flock Condition & Health Tracking
- Record clinical condition of birds: healthy, sick, weak, and under observation.
- Scope condition checks to a specific breed or across the whole house flock.
- Strict validation ensuring condition counts are non-negative whole numbers and cannot exceed available flock capacity.
- Real-time health metrics banner and inspection log table.

### 5. Expected Slaughter Date & Harvest Planning
- Schedule harvest batches with placement date, expected slaughter date, bird quantity, and market notes.
- Strict date validation ensuring expected slaughter date cannot be earlier than placement date.
- Quantity validation ensuring slaughter birds do not exceed available birds for the selected breed or house.
- Dynamic status calculation relative to the current date:
  - **Overdue:** Expected slaughter date is in the past.
  - **Due today:** Expected slaughter date is today.
  - **Due soon:** Expected slaughter date is within 7 days.
  - **Upcoming:** Expected slaughter date is more than 7 days away.
  - **Completed:** Marked completed by the user.
- One-click harvest completion toggle (`✓ Mark Completed` / `↺ Mark Pending`).
- Prominent harvest warning banner on the dashboard alerting managers of urgent or overdue slaughter batches.

### 6. Daily Production Records
- Daily tracking of mortality, feed consumed in kilograms, and eggs collected.
- Enforces unique date per house (no duplicate records for the same day).
- Enforces mortality limit: Cumulative mortality cannot exceed birds placed.

### 7. Interactive Farm Dashboard & Clean UI
- Live summary cards: Current Birds, Flock Loss %, Feed Consumed (kg), Eggs Collected, and Cataloged Breeds.
- Tabbed workspace:
  - 📅 **Daily Records**
  - 🐓 **Bird Breeds**
  - 🩺 **Health & Condition**
  - 🔪 **Slaughter Planning**
- User profile badge with 1-click Demo Farm Account login option.
- Reusable confirmation dialogs protecting destructive actions.
- Responsive design for desktop, tablet, and mobile devices.

---

## Architecture

```text
.
|-- backend/
|   |-- prisma/
|   |   |-- migrations/
|   |   |   `-- 20260916225500_add_users_breeds_health_slaughter/
|   |   `-- schema.prisma
|   |-- src/
|   |   |-- controllers/
|   |   |   |-- auth.controller.js
|   |   |   |-- birdCondition.controller.js
|   |   |   |-- breed.controller.js
|   |   |   |-- dailyRecord.controller.js
|   |   |   |-- dashboard.controller.js
|   |   |   |-- house.controller.js
|   |   |   `-- slaughterPlan.controller.js
|   |   |-- lib/prisma.js
|   |   |-- middleware/
|   |   |   |-- auth.middleware.js
|   |   |   |-- validate.js
|   |   |   `-- validation.schemas.js
|   |   |-- routes/
|   |   |   |-- auth.routes.js
|   |   |   |-- birdCondition.routes.js
|   |   |   |-- breed.routes.js
|   |   |   |-- dailyRecord.routes.js
|   |   |   |-- dashboard.routes.js
|   |   |   |-- house.routes.js
|   |   |   `-- slaughterPlan.routes.js
|   |   |-- services/
|   |   |   `-- dashboard.service.js
|   |   `-- server.js
|   `-- test/
|       `-- api.test.js
|-- frontend/
|   |-- src/
|   |   |-- components/
|   |   |   |-- AuthModal.jsx
|   |   |   |-- BirdConditionForm.jsx
|   |   |   |-- BreedForm.jsx
|   |   |   |-- ConfirmDialog.jsx
|   |   |   |-- DailyRecordEditForm.jsx
|   |   |   |-- DailyRecordForm.jsx
|   |   |   |-- HouseEditForm.jsx
|   |   |   |-- HouseForm.jsx
|   |   |   `-- SlaughterPlanForm.jsx
|   |   |-- services/
|   |   |   `-- api.js
|   |   |-- App.css
|   |   |-- App.jsx
|   |   `-- main.jsx
|   `-- package.json
|-- docs/
|-- CONTRIBUTING.md
`-- README.md
```

---

## Requirements

- **Node.js:** 18.x or newer (Node 20+ recommended)
- **npm:** 9.x or newer
- **PostgreSQL:** 13 or newer (or cloud Postgres such as Neon / Supabase)

---

## Setup & Installation

### 1. Clone Repository & Install Dependencies

```bash
git clone https://github.com/Ass-Gaye/Farm-Management-System.git
cd Farm-Management-System

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Configure Environment Variables

In `backend/.env`:
```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="7d"
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

In `frontend/.env` (optional, defaults to `http://localhost:5000/api`):
```env
VITE_API_URL=http://localhost:5000/api
```

### 3. Apply Database Migrations

Run Prisma migrations to create all tables and relationships:

```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

For production deployment:
```bash
npx prisma migrate deploy
```

---

## Running the Application

### Start the Backend API

```bash
cd backend
npm run dev
```
The API server runs at `http://localhost:5000`.

### Start the Frontend Client

```bash
cd frontend
npm run dev
```
The Vite development server runs at `http://localhost:5173`.

---

## API Reference

All protected endpoints require an `Authorization: Bearer <token>` header. All responses return a standard JSON structure: `{ "success": boolean, "data"?: any, "message"?: string }`.

### Authentication (`/api/auth`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register a new farm manager | No |
| `POST` | `/api/auth/login` | Authenticate and obtain JWT token | No |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | Yes |

### Poultry Houses (`/api/houses`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/houses` | List houses owned by authenticated user | Yes |
| `POST` | `/api/houses` | Create a new poultry house | Yes |
| `GET` | `/api/houses/:id` | Get house details and records | Yes |
| `PUT` | `/api/houses/:id` | Update poultry house details | Yes |
| `DELETE` | `/api/houses/:id` | Delete poultry house (cascades related data) | Yes |
| `GET` | `/api/houses/:id/dashboard` | Aggregated dashboard stats for the house | Yes |

### Bird Breeds (`/api/breeds`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/breeds?houseId=:id` | List breeds for a poultry house | Yes |
| `POST` | `/api/breeds` | Add a new breed to a poultry house | Yes |
| `GET` | `/api/breeds/:id` | Get breed details and history | Yes |
| `PUT` | `/api/breeds/:id` | Update breed information | Yes |
| `DELETE` | `/api/breeds/:id` | Delete a breed record | Yes |

### Health & Bird Conditions (`/api/bird-conditions`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/bird-conditions?houseId=:id` | List condition records for a house | Yes |
| `POST` | `/api/bird-conditions` | Record flock health check | Yes |
| `GET` | `/api/bird-conditions/:id` | Get specific health condition log | Yes |
| `PUT` | `/api/bird-conditions/:id` | Update health condition record | Yes |
| `DELETE` | `/api/bird-conditions/:id` | Delete health condition record | Yes |

### Slaughter Planning (`/api/slaughter-plans`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/slaughter-plans?houseId=:id` | List slaughter plans with computed status | Yes |
| `POST` | `/api/slaughter-plans` | Schedule a new slaughter plan | Yes |
| `GET` | `/api/slaughter-plans/:id` | Get slaughter plan details | Yes |
| `PUT` | `/api/slaughter-plans/:id` | Update slaughter plan | Yes |
| `PATCH` | `/api/slaughter-plans/:id/complete` | Toggle harvest completion status | Yes |
| `DELETE` | `/api/slaughter-plans/:id` | Delete a slaughter plan | Yes |

### Daily Records (`/api/daily-records`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/daily-records?houseId=:id` | List daily records (filtered by house) | Yes |
| `POST` | `/api/daily-records` | Log daily mortality, feed, and eggs | Yes |
| `GET` | `/api/daily-records/:id` | Get single daily record | Yes |
| `PUT` | `/api/daily-records/:id` | Update daily record | Yes |
| `DELETE` | `/api/daily-records/:id` | Delete daily record | Yes |

### System Health
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/health` | Health check endpoint | No |

---

## Database Models

```mermaid
erDiagram
    User ||--o{ PoultryHouse : "owns"
    PoultryHouse ||--o{ DailyRecord : "has"
    PoultryHouse ||--o{ Breed : "contains"
    PoultryHouse ||--o{ BirdCondition : "tracks"
    PoultryHouse ||--o{ SlaughterPlan : "schedules"
    Breed ||--o{ BirdCondition : "referenced by"
    Breed ||--o{ SlaughterPlan : "referenced by"

    User {
        Int id PK
        String email UK
        String password
        String name
        DateTime createdAt
    }

    PoultryHouse {
        Int id PK
        Int userId FK
        String name
        Int birdsPlaced
        DateTime createdAt
    }

    Breed {
        Int id PK
        Int houseId FK
        String name
        String description
        Int numberOfBirds
        DateTime dateAdded
    }

    BirdCondition {
        Int id PK
        Int houseId FK
        Int breedId FK
        Int healthy
        Int sick
        Int weak
        Int underObservation
        String notes
        DateTime recordDate
    }

    SlaughterPlan {
        Int id PK
        Int houseId FK
        Int breedId FK
        Int numberOfBirds
        DateTime placementDate
        DateTime expectedSlaughterDate
        String status
        String notes
    }

    DailyRecord {
        Int id PK
        Int houseId FK
        DateTime date
        Int mortality
        Float feedUsedKg
        Int eggsCollected
    }
```

---

## Testing & Quality Assurance

### Automated Backend Tests
Run the comprehensive integration test suite verifying user isolation, authentication guards, capacity validation, and feature lifecycles:

```bash
cd backend
npm test
```

### Frontend Linting & Build Verification

```bash
cd frontend
npm run lint    # ESLint verification
npm run build   # Production bundle build
```

---

## Deployment Configuration

### Backend Deployment (e.g. Render / Railway)
- **Root Directory:** `backend`
- **Build Command:** `npm install && npx prisma generate && npx prisma migrate deploy`
- **Start Command:** `npm start`
- **Environment Variables:**
  - `DATABASE_URL`: PostgreSQL connection string
  - `JWT_SECRET`: Secure random string
  - `NODE_ENV`: `production`
  - `CORS_ORIGIN`: Your production frontend URL (e.g. `https://your-farm.vercel.app`)

### Frontend Deployment (e.g. Vercel / Netlify)
- **Root Directory:** `frontend`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Environment Variables:**
  - `VITE_API_URL`: Your deployed backend API URL (e.g. `https://your-api.railway.app/api`)

---

## License

This project is distributed under the MIT License. See [LICENSE](LICENSE) for details.