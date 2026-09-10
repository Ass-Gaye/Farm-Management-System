# API Reference

Base URL for local development: `http://localhost:5000/api`

There is no authentication or authorization in the current API. Requests use JSON bodies where a body is required. Successful responses use `{ "success": true, ... }`; resource responses place the resource or list in `data`.

## Common Validation Rules

Validation is implemented with Zod in `backend/src/middleware/validation.schemas.js` and applied by `validate.js`.

- Numeric fields must be JSON numbers, not numeric strings.
- Dates are coerced to JavaScript `Date` values when valid.
- Unknown object fields are stripped by the current Zod object schemas.
- Validation failures return `400` with `message: "Validation failed"` and field-level `errors`.

## Health

### `GET /api/health`

Returns an API health message. No parameters or body.

Success `200`:

```json
{
  "success": true,
  "message": "Poultry Management API is running"
}
```

## Poultry Houses

### `POST /api/houses`

Creates a poultry house.

Request body:

```json
{
  "name": "House A",
  "birdsPlaced": 500,
  "createdAt": "2026-09-10"
}
```

Rules:

- `name` is a trimmed string of at least two characters.
- `birdsPlaced` is a positive integer.
- `createdAt` must be a valid date.

Success `201`:

```json
{
  "success": true,
  "message": "Poultry house created successfully",
  "data": {
    "id": 1,
    "name": "House A",
    "birdsPlaced": 500,
    "createdAt": "2026-09-10T00:00:00.000Z"
  }
}
```

Possible errors: `400` validation failure, `500` unexpected database/application error.

### `GET /api/houses`

Returns all houses ordered by `createdAt` descending.

Success `200`:

```json
{
  "success": true,
  "data": []
}
```

No query parameters are currently supported.

### `GET /api/houses/:id`

Returns one house and its daily records, ordered by record date descending.

Path parameter: `id`, the integer house ID.

Success `200` returns `{ success: true, data: house }`, where `house.dailyRecords` contains the related records.

Errors: `400` for an invalid positive-integer ID, `404` with `Poultry house not found` when the ID does not exist, or `500` for an unexpected failure.

### `PUT /api/houses/:id`

Replaces the editable house fields using the same required body as `POST /api/houses`.

Additional rule: `birdsPlaced` cannot be lower than the sum of existing record mortality.

Success `200`:

```json
{
  "success": true,
  "message": "Poultry house updated successfully",
  "data": { "id": 1, "name": "House A", "birdsPlaced": 500 }
}
```

Errors: `400` validation or bird-count rule failure, `404` if the house does not exist, `500` unexpected failure.

### `DELETE /api/houses/:id`

Deletes a house. The database relation cascades deletion to its daily records.

Success `200`:

```json
{
  "success": true,
  "message": "Poultry house deleted successfully"
}
```

Errors: `404` if the house does not exist, `500` unexpected failure.

## Daily Records

Daily records use flat routes under `/api/daily-records`. There are no nested `/api/houses/:houseId/records` routes.

### `POST /api/daily-records`

Creates a record for an existing house.

Request body:

```json
{
  "houseId": 1,
  "date": "2026-09-10",
  "mortality": 5,
  "feedUsedKg": 12.5,
  "eggsCollected": 40
}
```

Validation: `houseId` positive integer; valid `date`; nonnegative integer `mortality`; nonnegative numeric `feedUsedKg`; nonnegative integer `eggsCollected`.

Business rules:

- The referenced house must exist.
- Mortality cannot exceed current birds before this record.
- The exact `(houseId, date)` pair must be unique.

Success `201` returns `Daily record created successfully` and the created record.

Errors: `400` validation or mortality rule, `404` missing house, `409` duplicate house/date, `500` unexpected failure.

### `GET /api/daily-records`

Returns every daily record globally, includes the related `house`, and orders by `date` descending. The frontend filters this list for the selected house.

Success `200`: `{ success: true, data: records }`.

### `GET /api/daily-records/:id`

Returns one record including its related house.

Success `200`: `{ success: true, data: record }`.

Errors: `400` for an invalid positive-integer ID, `404` with `Daily record not found`, or `500` for unexpected failures.

### `PUT /api/daily-records/:id`

Updates `date`, `mortality`, `feedUsedKg`, and `eggsCollected`. `houseId` is not accepted as an update field.

Request body:

```json
{
  "date": "2026-09-10",
  "mortality": 3,
  "feedUsedKg": 13.5,
  "eggsCollected": 45
}
```

Mortality is checked against the house's birds after excluding the record currently being edited. The same unique house/date constraint applies.

Success `200` returns `Daily record updated successfully` and the updated record.

Errors: `400` validation or mortality rule, `404` missing record, `409` duplicate date, `500` unexpected failure.

### `DELETE /api/daily-records/:id`

Deletes one daily record.

Success `200`:

```json
{
  "success": true,
  "message": "Daily record deleted successfully"
}
```

Errors: `404` if the record does not exist, `500` unexpected failure.

## Dashboard

### `GET /api/houses/:houseId/dashboard`

Returns the selected house and aggregate statistics calculated by `dashboard.service.js`.

Success `200`:

```json
{
  "success": true,
  "data": {
    "house": {
      "id": 1,
      "name": "House A",
      "birdsPlaced": 500,
      "createdAt": "2026-09-10T00:00:00.000Z"
    },
    "statistics": {
      "currentBirds": 495,
      "totalMortality": 5,
      "totalFeedUsed": 12.5,
      "totalEggsCollected": 40
    }
  }
}
```

Calculations:

- `totalMortality`: sum of all record mortality.
- `totalFeedUsed`: sum of all `feedUsedKg` values.
- `totalEggsCollected`: sum of all egg counts.
- `currentBirds`: `birdsPlaced - totalMortality`.

Errors: `404` with `Poultry house not found` or `500` for unexpected failures.