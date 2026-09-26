# 🐔 Poultry Farm Management System

A production-grade, multi-tenant poultry farm management platform built with **React 19**, **Node.js / Express 5**, **Prisma ORM**, and **PostgreSQL**.

The system coordinates bird inventory, daily production records, feed stock conversions, customer receivables, supplier payables, harvest planning, and health protocols within strict database serializable transactions.

---

## 📑 Table of Contents

- [🌾 Plain-English Guide for Farm Owners & Managers (Non-Technical)](#-plain-english-guide-for-farm-owners--managers-non-technical)
  - [The Big Picture](#the-big-picture)
  - [Daily Farm Routine: How to Use the App](#daily-farm-routine-how-to-use-the-app)
  - [Keeping Track of Your Birds](#keeping-track-of-your-birds)
  - [What Happens if You Make a Mistake? (The 7-Day Rule)](#what-happens-if-you-make-a-mistake-the-7-day-rule)
  - [Feed Stock & Inventory Management](#feed-stock--inventory-management)
  - [Managing Money, Customer Credit & Supplier Debt](#managing-money-customer-credit--supplier-debt)
  - [Planning Harvests & Depopulation](#planning-harvests--depopulation)
  - [Vaccinations & Flock Health](#vaccinations--flock-health)
- [🏗️ Technical Architecture](#️-technical-architecture)
- [🗄️ Database Schema & Data Models](#️-database-schema--data-models)
- [🔐 Authentication & Multi-Tenancy](#-authentication--multi-tenancy)
- [⚙️ Core Technical Workflows](#️-core-technical-workflows)
  - [Bird Accounting Formula](#bird-accounting-formula)
  - [Daily Production & 7-Day Immutability Window](#daily-production--7-day-immutability-window)
  - [Feed Inventory & Unit Conversions](#feed-inventory--unit-conversions)
  - [Financial Transactions & Debt Tracking](#financial-transactions--debt-tracking)
  - [Slaughter Planning & Depopulation Sync](#slaughter-planning--depopulation-sync)
- [📡 API Reference](#-api-reference)
- [🚀 Setup & Installation](#-setup--installation)
- [🧪 Testing & Quality Assurance](#-testing--quality-assurance)

---

## 🌾 Plain-English Guide for Farm Owners & Managers (Non-Technical)

### The Big Picture
Managing a poultry farm requires juggling birds, feed, medicines, sales, and expenses every day. A single mistake—like forgetting feed consumption, miscounting dead birds, or losing track of customer credit—can silently eat away your profits.

This application acts as your **digital farm manager**. It connects every part of your farm so that:
- When birds eat feed, your **feed stock automatically drops**.
- When birds die or are sold, your **live bird count updates immediately**.
- When you sell eggs or birds on credit, the app tracks **who owes you money**.
- When you buy feed or chicks without paying upfront, the app tracks **who you owe money to**.
- When your feed stock gets dangerously low, the app **alerts you before you run out**.

```
[ Buy Feed / Chicks ]  ──►  Stock & Debt Recorded
         │
         ▼
[ Daily Routine ]      ──►  Feed Used, Deaths Logged, Eggs Collected
         │
         ▼
[ Sell Eggs / Birds ]  ──►  Revenue In, Credit Tracked, Birds Decremented
         │
         ▼
[ Farm Dashboard ]     ──►  Real-time Profit, Mortality %, and Feed Levels
```

---

### Daily Farm Routine: How to Use the App

#### 1. Morning Check-in & House Setup
- **Houses**: Create a digital representation of your sheds (e.g., "House 1", "Broiler Shed A").
- **Flocks**: Whenever a new batch of chicks arrives from the hatchery, enter the flock name, breed, arrival date, and how many birds were placed (e.g., 5,000 birds).

#### 2. Logging Daily Production (End of Each Day)
At the end of each day, open **Daily Records** and enter three key numbers:
1. **Mortality**: How many birds died today?
2. **Feed Consumed**: How many bags or kilograms of feed did the birds eat today?
3. **Eggs Collected**: (For layers) How many total eggs were collected, and how many were broken/damaged?

**What the app does automatically in the background:**
- Deducts the mortality from your active live bird count.
- Deducts the feed eaten from your feed inventory warehouse.
- Calculates your flock's laying percentage and mortality rate.
- Prevents double-entry (you cannot accidentally enter two records for the same house on the same date).

---

### Keeping Track of Your Birds
The app maintains a 100% accurate count of live birds using a simple rule:
$$\text{Live Birds Today} = \text{Initial Birds Placed} - \text{Total Deaths} - \text{Total Birds Sold/Harvested}$$

You can never accidentally record more deaths or sales than the birds you actually have alive. The system protects you from negative bird counts.

---

### What Happens if You Make a Mistake? (The 7-Day Rule)

Farmers are busy, and recounting happens. The app has a smart safety policy for editing historical records:

- **Within 7 Days of Logging**:
  If you notice a typo within 7 days, you can directly edit the record. The app will automatically recalculate the feed stock and flock count for you.
- **After 7 Days (Locked for Audit)**:
  To prevent tampering, tax discrepancies, or bookkeeping confusion, records older than 7 days **cannot be directly edited or deleted**. Instead, you use the **"Submit Correction"** button to log an official adjustment (e.g., `+3 mortality` or `-50 eggs`) with a written reason. Your history stays clean, honest, and auditable.

---

### Feed Stock & Inventory Management

Running out of feed can stall bird growth or stop egg production. The app manages feed like a warehouse:
1. **Choose Your Unit**: Track feed in **Kilograms (kg)** or **Bags** (e.g., 50 kg bags). The app converts between them automatically.
2. **Buy Feed**: When feed arrives, record a purchase. Your stock increases instantly.
3. **Daily Feeding**: As workers log daily records, feed is deducted from stock.
4. **Low Stock Warnings**: If feed drops below your minimum safety limit (e.g., 20 bags), a warning banner appears on your dashboard so you reorder in time.
5. **Damaged / Spilled Feed**: Log wastage or returns with a single click to keep digital stock matching physical bags in your shed.

---

### Managing Money, Customer Credit & Supplier Debt

#### Selling Products (Eggs, Meat, Live Birds, Manure)
- When a customer buys from you, record an **Income** entry.
- If the customer pays in full: marked as **PAID**.
- If the customer pays part or nothing: marked as **PARTIALLY PAID** or **UNPAID**.
- The unpaid balance is automatically added to that **Customer's Account**. You can see exactly how much every buyer owes your farm.
- When they pay you later, open **Settle Payment** to record the cash, and their debt decreases.

#### Buying Supplies (Chicks, Feed, Medicines, Bedding)
- When you purchase from a vendor, record an **Expense** entry.
- Any unpaid amount goes straight to your **Supplier Debt Balance**.
- You can never accidentally delete a customer or supplier who still owes you money or whom you still owe.

---

### Planning Harvests & Depopulation

For broiler farmers, timing the market is everything:
1. **Slaughter Scheduling**: Set a target harvest date (e.g., Day 42) and target weight (e.g., 2.2 kg).
2. **Urgency Status**: The system highlights batches as `Upcoming`, `Due Soon`, `Due Today`, or `Overdue`.
3. **One-Click Completion**: When harvest day arrives, click **Mark Completed**. The app automatically records the depopulation event and removes those birds from your active shed.

---

### Vaccinations & Flock Health
- Use standard vaccination schedules for **Broilers** (e.g., Gumboro, Newcastle) or **Layers**.
- Track upcoming dates on the dashboard.
- Marking a vaccination as completed automatically logs the medication expense into your farm finances.

---

## 🏗️ Technical Architecture

The application is structured as a decoupled Client-Server system:

```
[ User Browser ]
       │
       ▼
[ React 19 SPA (Vite) ]
  ├── Routing: React Router v7 (Public & Protected routes)
  ├── State: FarmContext (User, selected house, active flocks, dashboard cache)
  └── HTTP Client: api.js (Fetch API with Bearer JWT interceptor)
       │
       ▼  (REST JSON over /api/*)
[ Express 5 API Server (Node.js) ]
  ├── Security: Helmet, CORS Whitelisting, Express Rate Limiter
  ├── Authentication: auth.middleware.js (JWT verify + DB User lookup)
  ├── Validation: validate.js (Zod schemas via validation.schemas.js)
  ├── Controllers & Services: Business logic orchestration
  ├── Transactions: runSerializable() with retry on P2034 serialization conflicts
  └── ORM: Prisma Client
       │
       ▼  (SQL via Connection Pool)
[ PostgreSQL Database ]
```

### Key Technical Properties
- **Strict Multi-Tenancy**: All records are scoped by `userId` directly or through `PoultryHouse`. Cross-tenant data leakage is prevented at the database query level.
- **Serializable Transactions**: High-concurrency operations (daily logs, depopulations, feed adjustments) run under PostgreSQL `Serializable` isolation with 3 automatic retries.
- **Stateless HMAC Password Reset**: Password reset tokens are signed JWTs using a secret composite of `JWT_SECRET + user.passwordHash`. Changing the password immediately invalidates all active reset tokens without database state.

---

## 🗄️ Database Schema & Data Models

Defined in [schema.prisma](file:///C:/Users/assga/poultry-management/backend/prisma/schema.prisma):

```mermaid
erDiagram
    User ||--o{ PoultryHouse : "owns"
    User ||--o{ FeedType : "defines"
    User ||--o{ Customer : "manages"
    User ||--o{ Supplier : "manages"
    User ||--o{ Income : "earns"
    User ||--o{ Expense : "spends"
    User ||--o{ InventoryMovement : "audits"

    PoultryHouse ||--o{ Flock : "houses"
    PoultryHouse ||--o{ DailyRecord : "logs"
    PoultryHouse ||--o{ Vaccination : "schedules"

    Flock ||--o{ DailyRecord : "accumulates"
    Flock ||--o{ DepopulationEvent : "depopulates"
    Flock ||--o{ SlaughterPlan : "targets"
    Flock ||--o{ Vaccination : "receives"
    Breed ||--o{ Flock : "classifies"

    DailyRecord ||--o{ DailyRecordCorrection : "adjusted by"
    FeedType ||--o{ InventoryMovement : "records"
    FeedType ||--o{ DailyRecord : "consumed in"
    FeedType ||--o{ Expense : "purchased via"

    Customer ||--o{ Income : "owes / pays"
    Supplier ||--o{ Expense : "billed by"
```

### Models Overview

| Model | Purpose | Key Attributes | Cascade Delete Behavior |
| :--- | :--- | :--- | :--- |
| **User** | Farm account owner | `id`, `email`, `passwordHash`, `name` | Cascades all owned houses, feeds, finances |
| **PoultryHouse** | Shed / barn facility | `name`, `capacity`, `houseType`, `userId` | Cascades flocks, daily records, vaccinations |
| **Flock** | Placed bird batch | `flockNumber`, `initialCount`, `currentBirds`, `status` | Cascades depopulations, daily records |
| **DailyRecord** | Daily operational log | `date`, `mortality`, `feedKg`, `eggsCollected` | Cascades corrections; `feedTypeId` SetNull |
| **DailyRecordCorrection**| Post-7-day audit adjustment | `delta`, `correctionType`, `reason`, `userId` | Cascades on daily record deletion |
| **DepopulationEvent** | Bird removal record | `count`, `reason` (SOLD, SLAUGHTERED, etc.) | Cascades on flock deletion |
| **FeedType** | Feed inventory catalog | `name`, `unit`, `bagWeightKg`, `currentStock` | Blocked if `currentStock > 0` |
| **InventoryMovement** | Feed balance ledger | `type`, `quantity`, `quantityKg`, `balanceAfter` | Cascades on feed type deletion |
| **Customer** | Produce buyer | `name`, `phone`, `balance` (receivables) | Blocked if `balance > 0` |
| **Supplier** | Supply vendor | `name`, `phone`, `balance` (payables) | Blocked if `balance > 0` |
| **Income** | Revenue transaction | `amount`, `amountPaid`, `amountDue`, `paymentStatus` | Reverts customer balance on delete |
| **Expense** | Cost transaction | `amount`, `amountPaid`, `amountDue`, `category` | Reverts supplier balance on delete |
| **SlaughterPlan** | Meat harvest target | `targetDate`, `targetWeightKg`, `targetBirds` | Cascades on flock deletion |
| **Vaccination** | Medication schedule | `name`, `targetDate`, `status`, `cost` | Cascades on house deletion |
| **Breed** | Reference bird breed | `name`, `birdType`, `standardGrowthRate` | Flocks set `breedId` to `NULL` on delete |
| **BirdCondition** | Health status reference | `name`, `severity` (NORMAL, MILD, SEVERE) | Records set `conditionId` to `NULL` |

---

## 🔐 Authentication & Multi-Tenancy

- **Password Hashing**: Passwords are hashed with `bcryptjs` (10 rounds).
- **JWT Authentication**: Tokens are signed with `HS256` and valid for 7 days.
- **Protected Endpoints**: Require `Authorization: Bearer <token>`. The middleware attaches the authenticated tenant to `req.user`.
- **Query Scoping**: Every query filters by `userId: req.user.id` or joins through an owned `PoultryHouse`.
- **Stateless Password Reset**:
  1. `POST /api/auth/forgot-password` generates a JWT signed with `${JWT_SECRET}-${user.passwordHash}` (1-hour expiry).
  2. The email contains a link to `/reset-password?token=...&id=...`.
  3. `POST /api/auth/reset-password` verifies the signature using the user's current password hash.
  4. Updating the password changes the hash, instantly invalidating the token.

---

## ⚙️ Core Technical Workflows

### Bird Accounting Formula
At any point in time, live birds in an active flock are computed as:
$$\text{Current Live Birds} = \text{Flock.initialCount} - \sum (\text{Mortality} + \text{Mortality Corrections}) - \sum \text{Depopulation Counts}$$
This invariant is enforced within serializable transactions during daily record creation, post-7-day corrections, and depopulation logging.

---

### Daily Production & 7-Day Immutability Window

```
User submits Daily Record
           │
           ▼
[ < 7 Days Old ]  ──►  Direct PUT / DELETE allowed.
                       - Old feed reversed in inventory.
                       - New feed deducted.
                       - Flock currentBirds delta adjusted.
           │
           ▼
[ >= 7 Days Old ] ──►  Direct PUT / DELETE rejected (403 RECORD_IMMUTABLE).
                       - Must call POST /api/daily-records/:id/corrections.
                       - Creates append-only DailyRecordCorrection row.
                       - Adjusts Flock.currentBirds by delta.
                       - Preserves historical audit integrity.
```

---

### Feed Inventory & Unit Conversions

- Feed stock is maintained on the `FeedType` model in its designated unit (`KG` or `BAG`).
- Conversion formula:
  $$\text{Bags} = \frac{\text{Kg}}{\text{bagWeightKg}}, \quad \text{Kg} = \text{Bags} \times \text{bagWeightKg}$$
- **Negative Stock Guard**: A transaction aborts with `INSUFFICIENT_STOCK` (400) if a deduction exceeds `currentStock`.
- **Automatic Purchases**: Creating an `Expense` with category `FEED` automatically generates an `InventoryMovement` of type `PURCHASE` and increases stock.
- **Audit Ledger**: Every change appends an immutable `InventoryMovement` row storing `balanceAfter`.

---

### Financial Transactions & Debt Tracking

- **Receivables (Customer Credit)**:
  $$\text{Customer.balance} = \sum \text{Income.amountDue}$$
- **Payables (Supplier Debt)**:
  $$\text{Supplier.balance} = \sum \text{Expense.amountDue}$$
- **Payment Settlement**:
  Updating an income or expense via `PaymentModal` increments `amountPaid`, decrements `amountDue`, re-evaluates `paymentStatus` (`PAID`, `PARTIALLY_PAID`, `UNPAID`), and decreases the entity balance.
- **Deletion Safeguard**: Deleting customers or suppliers with `balance > 0` is rejected with `DEBT_OUTSTANDING` (400).

---

### Slaughter Planning & Depopulation Sync

- When a `SlaughterPlan` is toggled to `COMPLETED`:
  1. A `DepopulationEvent` is automatically created with reason `SLAUGHTERED` and bird count equal to `actualBirds`.
  2. `Flock.currentBirds` is decremented atomically.
- If toggled back to `PENDING`:
  1. The linked `DepopulationEvent` is deleted.
  2. Bird count is restored to the flock.

---

## 📡 API Reference

All protected endpoints require `Authorization: Bearer <token>`.

### Authentication (`/api/auth`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register new user account |
| `POST` | `/api/auth/login` | Login and receive 7-day JWT |
| `GET` | `/api/auth/me` | Fetch authenticated user profile |
| `POST` | `/api/auth/forgot-password` | Send password reset email |
| `POST` | `/api/auth/reset-password` | Reset password using HMAC token |

### Houses & Dashboard (`/api/houses`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/houses` | List user's poultry houses |
| `POST` | `/api/houses` | Create a new poultry house |
| `GET` | `/api/houses/:id` | Get house details and records |
| `PUT` | `/api/houses/:id` | Update house name / capacity |
| `DELETE` | `/api/houses/:id` | Delete house (cascades related data) |
| `GET` | `/api/houses/:id/dashboard` | Aggregated metrics (birds, feed, cash flow) |

### Flocks (`/api/flocks`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/flocks?houseId=:id` | List flocks for a house |
| `POST` | `/api/flocks` | Onboard a new flock batch |
| `GET` | `/api/flocks/:id` | Get flock details and history |
| `PATCH` | `/api/flocks/:id/status` | Update flock status (ACTIVE, DEPLETED, ARCHIVED) |

### Daily Records & Corrections (`/api/daily-records`, `/api/houses/:houseId/daily-records`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/daily-records?houseId=:id` | List daily records |
| `POST` | `/api/houses/:houseId/daily-records`| Log daily mortality, feed, and eggs |
| `PUT` | `/api/daily-records/:id` | Update record (within 7-day window) |
| `DELETE` | `/api/daily-records/:id` | Delete record & revert feed (within 7 days) |
| `POST` | `/api/daily-records/:id/corrections`| Append-only correction for locked records |

### Inventory & Feed (`/api/inventory`, `/api/feed-types`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/feed-types` | List registered feed formulations |
| `POST` | `/api/feed-types` | Create feed type (unit, bag weight, reorder level) |
| `GET` | `/api/inventory` | Real-time stock levels & low stock alerts |
| `POST` | `/api/inventory/adjust` | Log manual stock adjustment, wastage, or return |
| `GET` | `/api/inventory/movements`| Full audit ledger of stock movements |

### Finance, Customers & Suppliers (`/api/finance`, `/api/customers`, `/api/suppliers`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/finance/summary` | Cash flow, money in/out, payables, receivables |
| `POST` | `/api/finance/income` | Record product sale (optional customer credit) |
| `POST` | `/api/finance/expense` | Record farm expense (auto feed stock if FEED) |
| `PUT` | `/api/finance/income/:id` | Settle customer payment |
| `PUT` | `/api/finance/expense/:id`| Settle supplier payment |
| `GET` | `/api/customers` | Customer directory with outstanding balances |
| `GET` | `/api/suppliers` | Supplier directory with outstanding debts |

### Slaughter & Depopulation (`/api/slaughter-plans`, `/api/depopulations`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/slaughter-plans` | List harvest schedules with status chips |
| `POST` | `/api/slaughter-plans` | Schedule slaughter target date and weight |
| `PATCH` | `/api/slaughter-plans/:id/status`| Mark completed (auto-creates depopulation) |
| `POST` | `/api/depopulations` | Record bird removal (SOLD, CULLED, SLAUGHTERED) |

### Vaccinations (`/api/vaccinations`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/vaccinations?houseId=:id`| List scheduled and completed treatments |
| `POST` | `/api/vaccinations` | Schedule single vaccination |
| `POST` | `/api/vaccinations/template`| Auto-generate broiler or layer schedule |
| `PATCH` | `/api/vaccinations/:id/complete`| Mark completed and log expense |

---

## 🚀 Setup & Installation

### Prerequisites
- **Node.js**: v18.x or v20+
- **npm**: v9.x or newer
- **PostgreSQL**: v13+ (Local or cloud instance like Neon / Supabase)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Ass-Gaye/Farm-Management-System.git
cd Farm-Management-System

# Install backend packages
cd backend
npm install

# Install frontend packages
cd ../frontend
npm install
```

### 2. Configure Environment Variables

Create `backend/.env`:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/poultry_db?schema=public"
JWT_SECRET="your-super-strong-jwt-secret-key"
JWT_EXPIRES_IN="7d"
PORT=5000
NODE_ENV=development
CORS_ORIGIN="http://localhost:5173"

# Optional Email Service for Password Resets (Resend or SMTP)
RESEND_API_KEY=""
SMTP_HOST=""
SMTP_PORT=587
SMTP_USER=""
SMTP_PASS=""
EMAIL_FROM="noreply@yourfarm.com"
```

Create `frontend/.env` (optional, defaults to `http://localhost:5000/api`):
```env
VITE_API_URL="http://localhost:5000/api"
```

### 3. Run Database Migrations
```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

### 4. Start Development Servers

Start Backend:
```bash
cd backend
npm run dev
# Server running at http://localhost:5000
```

Start Frontend:
```bash
cd frontend
npm run dev
# Client running at http://localhost:5173
```

---

## 🧪 Testing & Quality Assurance

Run the automated backend test suite:
```bash
cd backend
npm test
```

Verify frontend linting and build:
```bash
cd frontend
npm run lint
npm run build
```

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.