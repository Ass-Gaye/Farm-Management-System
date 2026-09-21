You are working on an existing poultry farm management application that is already live and being tested by real poultry businesses in The Gambia.

Your task is to implement PHASE 1: FLOCK & BATCH MANAGEMENT.

IMPORTANT:
- Work locally only.
- DO NOT deploy.
- DO NOT push to GitHub.
- DO NOT remove or break any existing functionality.
- Before changing anything, inspect the entire existing project structure, database schema, API routes, frontend components, authentication, and current poultry-management features.
- Reuse the existing architecture, UI design system, naming conventions, and technologies wherever possible.
- Do not rebuild existing functionality unnecessarily.
- Make changes incrementally and test after each major change.

CURRENT FEATURES THAT MUST CONTINUE WORKING:
- User authentication/accounts
- Farm management
- Daily records
- Bird mortality recording
- Feed usage recording
- Egg collection recording
- Bird breeds
- Health conditions
- Slaughter planning
- Dashboard
- Current birds calculation
- Total mortality
- Total feed usage
- Total eggs collected
- Number of flock/breeds statistics

OBJECTIVE:

Introduce proper FLOCK/BATCH MANAGEMENT so that a poultry business can manage multiple groups of birds separately.

A flock/batch represents one specific group of birds placed into a farm/house at approximately the same time.

Example:

Flock: Broiler Batch #001
Breed: Cobb 500
House: House A
Birds Placed: 500
Placement Date: 2026-09-01
Purpose: Broiler
Status: Active

FUNCTIONAL REQUIREMENTS:

1. FLOCK CREATION

Allow a user to create a flock with:

- Flock name/number
- Breed
- House
- Number of birds placed
- Placement date
- Bird type/purpose
  - Broiler
  - Layer
  - Breeder
  - Other
- Source/supplier (optional)
- Expected market/slaughter date (optional)
- Notes (optional)
- Status

Statuses:
- Active
- Completed
- Sold
- Slaughtered
- Archived

Validate all required fields.

Prevent invalid values such as:
- Negative bird quantities
- Invalid dates
- Empty flock names
- Negative numbers

2. FLOCK LIST

Create a clean flock-management page showing all flocks belonging to the authenticated user's farm.

Display:

- Flock name
- Breed
- House
- Bird type
- Birds placed
- Current birds
- Mortality
- Mortality rate
- Placement date
- Age
- Status

Include:

- Search
- Filtering by status
- Filtering by breed
- Filtering by house
- Sorting
- Pagination if necessary

3. FLOCK DETAILS

Create a dedicated flock details page.

The page should show:

BASIC INFORMATION:
- Flock name
- Breed
- House
- Bird type
- Placement date
- Age
- Initial birds
- Current birds
- Status

PERFORMANCE:
- Total mortality
- Mortality percentage
- Total feed consumed
- Average daily feed usage
- Total eggs collected where applicable
- Average daily egg production where applicable

TIMELINE:

Show important events associated with the flock:

- Daily records
- Health events
- Vaccinations when available
- Slaughter planning
- Sales when available
- Other relevant events

4. CONNECT DAILY RECORDS TO FLOCKS

Modify the existing daily-record system so that every daily record can optionally or preferably be associated with a specific flock.

Example:

Date:
2026-09-18

Flock:
Broiler Batch #001

Mortality:
3

Feed:
25 kg

Eggs:
0

The system must calculate flock-specific statistics from these records.

Do not duplicate existing daily-record data unnecessarily.

Use relationships between:

Farm → House → Flock → Daily Records

where this structure is compatible with the existing application.

5. AUTOMATIC CURRENT BIRD CALCULATION

For every flock:

Current Birds = Birds Placed - Total Mortality - Birds Removed/Sold/Slaughtered

The calculation must update automatically whenever relevant records are created, edited, or deleted.

Never allow current birds to become negative.

If the existing system already calculates current birds, refactor it carefully so that flock-level calculations remain accurate.

6. FLOCK MORTALITY ANALYTICS

Calculate:

- Total mortality
- Mortality rate
- Daily mortality
- Weekly mortality
- Monthly mortality where appropriate

Formula:

Mortality Rate =
(Total Mortality / Birds Placed) × 100

Display percentages clearly.

7. FLOCK AGE

Automatically calculate flock age from placement date.

For example:

Placement Date: September 1
Today: September 18

Age:
17 days

Display age in a user-friendly format such as:

17 days old

For older flocks:

8 weeks, 2 days old

Do not store calculated age unnecessarily if it can safely be calculated dynamically.

8. BREED INTEGRATION

Connect the existing breed functionality to flock management.

A flock should reference an existing breed rather than storing duplicate breed information.

If the existing breed system needs improvement, make only the changes necessary for proper flock integration.

9. HOUSE INTEGRATION

Connect each flock to a specific poultry house.

A farm can have:

House A
House B
House C

Each house can contain multiple historical or active flocks depending on the existing business model.

Do not allow users to access another user's houses or flocks.

10. HEALTH CONDITION INTEGRATION

Connect health records/health conditions to the appropriate flock.

A health event should be associated with:

- Flock
- Date
- Condition
- Number of affected birds
- Treatment/action
- Notes

Do not rebuild the entire health system if it already exists.

Only extend it where necessary.

11. SLAUGHTER PLANNING INTEGRATION

Connect slaughter planning to the flock.

A slaughter plan should identify:

- Flock
- Planned date
- Number of birds
- Reason/purpose
- Status

The system should make it possible to understand how many birds from a flock are planned for slaughter.

12. DASHBOARD IMPROVEMENT

Update the existing dashboard without removing its current statistics.

Add flock-focused statistics such as:

- Total active flocks
- Total active birds
- Total mortality
- Overall mortality rate
- Total feed used
- Total eggs collected
- Flocks requiring attention
- Upcoming slaughter plans

Add a section:

"Active Flocks"

Each flock card should show:

- Flock name
- Breed
- House
- Age
- Current birds
- Mortality rate
- Status

13. FARM-SPECIFIC DATA ISOLATION

This is extremely important.

A logged-in user must only see their own:

- Farms
- Houses
- Flocks
- Breeds
- Daily records
- Health records
- Slaughter plans
- Dashboard statistics

Never expose another farm user's information.

Enforce this at the backend/API/database authorization level, not only in the frontend.

14. DATABASE DESIGN

Inspect the existing Prisma/database schema before making changes.

Design appropriate relationships between:

User
Farm
House
Breed
Flock
DailyRecord
HealthRecord
SlaughterPlan

Do not create duplicate models if equivalent models already exist.

Use proper foreign keys and indexes.

Add unique constraints where appropriate.

Create a proper database migration.

Do not delete production data.

15. API

Create or update REST API endpoints following the existing project's conventions.

Required functionality:

- Create flock
- Get all flocks
- Get flock by ID
- Update flock
- Delete/archive flock
- Get flock statistics
- Get flock daily records
- Get flock health records
- Get flock slaughter plans

Implement:

- Authentication
- Authorization
- Validation
- Proper HTTP status codes
- Consistent error handling

16. FRONTEND

Build the flock-management UI using the existing application's design language.

The UI must be:

- Mobile-first
- Responsive
- Fast
- Simple
- Easy for a farm manager to understand

Avoid unnecessarily complicated interfaces.

Use clear actions:

+ Add Flock
View
Edit
Archive
View Details

17. MOBILE DATA ENTRY

The application will primarily be used by farm managers and workers who may enter information while working on the farm.

Make flock and daily-record forms:

- Quick to complete
- Large enough for touch interaction
- Clear
- Minimal
- Easy to understand

Avoid unnecessary fields during daily operations.

18. VALIDATION & ERROR HANDLING

Implement proper validation on both frontend and backend.

Handle:

- Missing fields
- Invalid IDs
- Unauthorized access
- Invalid dates
- Negative quantities
- Duplicate records
- Database errors
- Network errors

Show human-readable error messages.

19. TESTING

Before considering Phase 1 complete:

Test:

- Creating a flock
- Editing a flock
- Viewing a flock
- Archiving a flock
- Adding daily records to a flock
- Editing daily records
- Deleting daily records
- Mortality calculations
- Current bird calculations
- Feed calculations
- Egg calculations
- Health-record relationships
- Slaughter-plan relationships
- Dashboard calculations
- User isolation
- Invalid input
- Unauthorized requests

Do not proceed if existing functionality is broken.

20. DATA MIGRATION

If existing daily records, breeds, houses, health conditions, or slaughter plans exist without flock relationships:

Do NOT blindly delete or modify them.

Determine the safest migration strategy.

Preserve existing user data.

If existing records cannot safely be assigned to a flock, allow them to remain compatible with the previous system while supporting flock-based records going forward.

21. CODE QUALITY

Keep the implementation production-ready.

Use:

- Clear naming
- Reusable components
- Proper separation of concerns
- Service/controller structure where applicable
- Centralized validation
- Proper error handling
- Environment variables
- Secure authentication
- No hardcoded secrets
- No unnecessary dependencies

Do not introduce unnecessary architecture or complexity.

22. BEFORE IMPLEMENTATION

First inspect the project and provide a short implementation report containing:

1. Current frontend architecture
2. Current backend architecture
3. Current database schema
4. Existing flock-related functionality
5. Existing daily-record structure
6. Existing breed structure
7. Existing house structure
8. Existing health-condition structure
9. Existing slaughter-planning structure
10. What needs to change
11. Potential compatibility risks
12. Recommended implementation order

Then implement Phase 1.

IMPORTANT:

Do not deploy.
Do not push.
Do not modify production.
Do not replace the existing application unnecessarily.

After implementation, run the appropriate tests/build/lint/database checks and report:

- Files changed
- Database changes
- API changes
- Frontend changes
- Tests performed
- Any remaining issues

Stop after Phase 1 is fully implemented and tested.






Implement PHASE 2: FARM INTELLIGENCE.

Build on the existing poultry management application and the completed Flock & Batch Management system.

Work locally only.
Do not deploy.
Do not push to GitHub.
Do not break existing functionality.

The goal is to transform the dashboard from a simple statistics screen into a practical decision-making dashboard for poultry businesses in The Gambia.

The dashboard should answer:

1. How many birds do I currently have?
2. Which flock is performing well?
3. Which flock is losing birds quickly?
4. How much feed am I using?
5. How many eggs am I producing?
6. Are mortality levels increasing?
7. Which flocks need attention?
8. What important farm activities are coming up?

Add:

- Mortality rate
- Feed-per-bird metrics
- Egg production rate
- Flock age
- Daily/weekly trends
- Flock comparisons
- Current active birds
- Upcoming slaughter plans
- Health issues requiring attention
- Low-performing flock indicators
- Recent farm activity

Create useful charts but avoid unnecessary visual complexity.

Use real database data.

Do not invent AI insights.

Any "insight" must be based on actual farm records.

Examples:

"Mortality increased compared with the previous 7 days."

"Flock A has recorded 18 deaths out of 500 birds."

"Feed usage increased this week."

Clearly distinguish calculated facts from recommendations.

Keep the dashboard mobile-friendly.

Test all calculations thoroughly.




Implement PHASE 3: FEED INVENTORY MANAGEMENT.

Work locally.
Do not deploy.
Do not push.
Do not break existing functionality.

Build a feed inventory system specifically for poultry farms.

Allow farm managers to:

- Add feed types
- Record feed purchases
- Record quantity received
- Record quantity used
- Record current stock
- Record supplier
- Record purchase price
- Record purchase date
- Record feed batch/lot if available
- Set minimum stock level

Support common feed categories such as:

- Starter
- Grower
- Finisher
- Layer feed
- Breeder feed
- Other

Connect feed usage to flock daily records.

Automatically calculate:

Current Feed Stock =
Total Feed Purchased - Total Feed Used

Add:

- Low-stock warnings
- Feed consumption trends
- Feed usage per flock
- Feed usage per bird
- Feed cost tracking where purchase prices exist

Use GMD for monetary values.

Make data entry extremely fast on mobile.

Preserve existing feed-usage records.

Test all stock calculations and prevent negative inventory unless explicitly supported by the business rules.





Implement PHASE 4: POULTRY HEALTH & VACCINATION MANAGEMENT.

Work locally.
Do not deploy.
Do not push.

Expand the existing health-condition functionality into a structured flock health-management system.

Allow users to record:

- Health condition
- Date detected
- Flock
- Number of affected birds
- Symptoms
- Treatment
- Medication
- Treatment start date
- Treatment end date
- Outcome
- Notes

Add vaccination management:

- Vaccine name
- Flock
- Date administered
- Number of birds vaccinated
- Next scheduled vaccination
- Dosage/notes
- Administered by

Create a health timeline for each flock.

Add upcoming vaccination reminders.

Add dashboard indicators for:

- Active health issues
- Upcoming vaccinations
- Recent health events
- Flocks with repeated health incidents

Do not provide veterinary diagnosis or medical recommendations.

The application should record and organize information supplied by the farm manager.

Keep the interface simple and mobile-friendly.



Implement PHASE 5: FARM EXPENSE MANAGEMENT.

Work locally.
Do not deploy.
Do not push.

Build a financial expense module for poultry businesses.

Allow users to record:

- Expense category
- Amount
- Date
- Description
- Supplier/vendor
- Flock association (optional)
- House association (optional)
- Receipt/reference number
- Notes

Create categories such as:

- Feed
- Medication
- Vaccination
- Labor
- Electricity
- Water
- Transportation
- Equipment
- Repairs
- Poultry purchase
- Packaging
- Other

Use GMD formatting.

Add:

- Daily expenses
- Weekly expenses
- Monthly expenses
- Expenses by category
- Expenses by flock
- Expense trends

Do not mix business expenses with personal expenses.

Update the dashboard with total expenses and expense trends.

Use proper validation and authorization.



Implement PHASE 6: POULTRY SALES & REVENUE MANAGEMENT.

Work locally.
Do not deploy.
Do not push.

Allow poultry businesses to record sales of:

- Live birds
- Eggs
- Dressed/slaughtered birds
- Other poultry products

A sale should support:

- Product type
- Flock
- Quantity
- Unit price
- Total amount
- Customer
- Sale date
- Payment status
- Payment method
- Notes

Calculate totals automatically.

Use GMD.

Connect sales to flock quantities where appropriate.

For birds sold or slaughtered, update the flock's available bird count correctly.

Prevent double-counting.

Add sales statistics:

- Today's revenue
- Weekly revenue
- Monthly revenue
- Revenue by flock
- Revenue by product
- Outstanding payments
- Completed payments

Test all bird-count and revenue calculations carefully.


Implement PHASE 7: FLOCK PROFITABILITY ANALYSIS.

Work locally.
Do not deploy.
Do not push.

Use the existing:

- Flock data
- Feed costs
- Health expenses
- Other flock expenses
- Bird sales
- Egg sales
- Other revenue

to calculate an estimated financial performance for each flock.

Display:

- Total revenue
- Total expenses
- Estimated profit
- Estimated loss
- Cost per bird
- Revenue per bird
- Feed cost
- Health cost
- Other costs
- Mortality impact where measurable

Clearly label calculations as estimates where the available data is incomplete.

Do not claim exact profitability if required costs or revenues have not been recorded.

Add flock profitability to the flock details page and dashboard.

Make the information understandable to a non-technical farm manager.



Implement PHASE 8: SMART FARM ALERTS.

Work locally.
Do not deploy.
Do not push.

Create a notification/alert system based entirely on actual farm data.

Examples:

- High mortality
- Increasing mortality
- Low feed stock
- Upcoming vaccination
- Upcoming slaughter
- Flock approaching expected market date
- Missing daily record
- Unusually low egg collection
- Unusually high feed consumption

Do not create arbitrary alerts.

Each alert must have:

- Type
- Severity
- Title
- Description
- Related flock/house
- Date
- Read/unread status

Allow users to:

- View alerts
- Mark as read
- Filter alerts
- Open the related flock or record

Avoid excessive notifications.

The goal is to help farm managers notice important events without overwhelming them.




Implement PHASE 9: STAFF MANAGEMENT.

Work locally.
Do not deploy.
Do not push.

Allow poultry businesses to add staff members to their farm.

Create roles such as:

- Owner
- Farm Manager
- Farm Worker
- Accountant/Finance
- Viewer

Define permissions carefully.

Examples:

Owner:
Full access.

Farm Manager:
Farm operations and reports.

Farm Worker:
Daily records and assigned operational tasks.

Accountant:
Expenses and sales.

Viewer:
Read-only access.

Ensure authorization is enforced on the backend.

A frontend-hidden button is NOT sufficient security.

Test that users cannot access unauthorized data through direct API requests.



Implement PHASE 10: FARM REPORTING.

Work locally.
Do not deploy.
Do not push.

Create professional farm reports.

Reports should include:

- Flock report
- Mortality report
- Feed consumption report
- Egg production report
- Health report
- Vaccination report
- Expense report
- Sales report
- Profitability report

Allow filtering by:

- Date range
- House
- Flock
- Breed

Allow export to:

- PDF
- CSV/Excel where appropriate

Reports must use real database data.

Use GMD for financial values.

Make reports suitable for farm management and record keeping.



Implement PHASE 11: LOW-CONNECTIVITY FARM EXPERIENCE.

The application is intended for poultry businesses in The Gambia, where internet connectivity may not always be reliable.

Work locally.
Do not deploy.

Improve the application so basic farm operations can continue during temporary connectivity problems.

Prioritize:

- Daily records
- Mortality
- Feed usage
- Egg collection
- Health records

Implement an appropriate offline/local queue strategy.

When connectivity returns:

- Synchronize records
- Prevent duplicate submissions
- Handle conflicts safely
- Show synchronization status

Do not silently lose user data.

Display clear states:

Online
Offline
Pending sync
Synced
Sync failed

Keep the experience simple for farm workers.



Implement PHASE 12: FARM BUSINESS CONTACTS.

Work locally.
Do not deploy.
Do not push.

Create simple management for:

SUPPLIERS:
- Name
- Phone
- Business
- Products supplied
- Notes

CUSTOMERS:
- Name
- Phone
- Business
- Customer type
- Notes

Connect suppliers to:

- Feed purchases
- Medication purchases
- Equipment purchases

Connect customers to:

- Bird sales
- Egg sales
- Poultry-product sales

Keep the feature lightweight.

Do not build a complicated CRM.



Implement PHASE 13: FARM PERFORMANCE BENCHMARKING.

Work locally.
Do not deploy.
Do not push.

Create optional benchmarking based on aggregated farm data.

Allow a farm manager to compare their own historical performance against:

- Their previous flock
- Their previous month
- Their previous production cycle

Do NOT expose another farm's private information.

Do NOT identify individual farms.

Show neutral metrics such as:

- Mortality rate
- Feed usage
- Egg production
- Revenue
- Cost per bird

Clearly explain the time period and data used.

Do not make unsupported claims that a farm is "good" or "bad".

The purpose is to help farmers understand changes in their own performance.



Implement PHASE 14: DATA-BASED AI FARM ASSISTANT.

Work locally.
Do not deploy.

Create an AI assistant that can answer questions using the authenticated farm's actual data.

Examples:

"How many birds do I currently have?"

"Which flock has the highest mortality this month?"

"How much feed did we use this week?"

"What expenses did we record this month?"

"How many eggs did we collect last week?"

"Which vaccinations are coming up?"

"How much did Flock A generate in sales?"

The AI must never invent farm statistics.

Every factual answer about the farm must come from actual database records.

If data is unavailable, say that the data is unavailable.

Keep farm data isolated between users.

Do not expose private information to external users.

The assistant should explain calculations clearly when appropriate.

This is an operational assistant, not a veterinary diagnostic system.

Do not allow it to present medical diagnosis or treatment as professional veterinary advice.
