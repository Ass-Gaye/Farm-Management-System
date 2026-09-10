# Request Flow: Create a House

This walkthrough follows the real `POST /api/houses` implementation.

```text
Frontend form
    |
    v
services/api.js
    |
    v
Express server.js
    |
    v
house.routes.js
    |
    v
validate(createHouseSchema)
    |
    v
house.controller.js
    |
    v
lib/prisma.js -> PostgreSQL
    |
    v
JSON response
```

## Step by Step

1. `HouseForm.jsx` collects `name`, `birdsPlaced`, and `createdAt`.
2. The form converts `birdsPlaced` to a JavaScript number and calls `createHouse` in `frontend/src/services/api.js`.
3. The API service sends JSON to `http://localhost:5000/api/houses` with `POST`.
4. `server.js` has already registered CORS and `express.json()`, so the body is available as `req.body`.
5. Express selects `house.routes.js` for `/api/houses`.
6. The route runs `validate(createHouseSchema)` before `createHouse`.
7. Zod checks that the name is at least two characters, birds are a positive integer, and the date is valid.
8. On success, `validate.js` assigns `result.data` back to `req.body`. This is important because the date has been coerced into a validated value and unknown fields have been removed.
9. `createHouse` reads the validated body and calls `prisma.poultryHouse.create`.
10. The shared Prisma client sends the insert to PostgreSQL using `DATABASE_URL`.
11. The controller responds with status `201`, a success message, and the created house in `data`.
12. The frontend receives the result, closes the form, reloads houses, and selects the new house.

## Failure Paths

- Invalid body: validation returns `400` before the controller runs.
- Database or unexpected controller error: the controller calls `next(error)` and the final error middleware returns generic `500` JSON.
- The current API does not have authentication middleware, so this flow is unauthenticated.