# Request Flow: Create a House

This walkthrough follows the real `POST /api/houses` implementation.

```text
Frontend form
    |
    v
services/api.js (attaches Authorization: Bearer <token>)
    |
    v
Express server.js (helmet, CORS, express.json)
    |
    v
house.routes.js (authenticate middleware)
    |
    v
validate(createHouseSchema)
    |
    v
house.controller.js (associates record with req.user.id)
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
3. The API service sends JSON to `http://localhost:5000/api/houses` with `POST` and attaches the user's JWT token in the `Authorization: Bearer <token>` header.
4. `server.js` applies security headers (`helmet`), CORS, and JSON body parsing, making the payload available on `req.body`.
5. Express routes the request into `house.routes.js`.
6. The `authenticate` middleware verifies the JWT token, confirms the user exists in PostgreSQL, and attaches `req.user`.
7. The route runs `validate(createHouseSchema)` before reaching the controller.
8. Zod validates that the name is at least two characters, birds are a positive integer, and the date is valid.
9. On success, `validate.js` assigns `result.data` back to `req.body`.
10. `createHouse` reads `req.body` and creates the record associated with `req.user.id` (`userId: req.user.id`) to guarantee tenant isolation.
11. The shared Prisma client sends the insert to PostgreSQL using `DATABASE_URL`.
12. The controller responds with status `201`, a success message, and the created house in `data`.
13. The frontend receives the result, closes the form, reloads houses, and selects the new house.

## Failure Paths

- Missing or invalid token: `authenticate` returns `401 Unauthorized` before processing continues.
- Invalid body: validation returns `400 Validation failed` with field-level errors before the controller runs.
- Database or unexpected controller error: the controller calls `next(error)` and the final error middleware returns generic `500` JSON.