const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const {
  stockAdjustmentSchema,
  createDailyRecordSchema,
  updateDailyRecordSchema,
  createCorrectionSchema,
} = require("../src/middleware/validation.schemas");

test("F1: reset token exposure is gated ONLY on explicit opt-in flag", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "..", "src", "controllers", "auth.controller.js"),
    "utf8"
  );
  // The insecure NODE_ENV-based backdoor must be gone.
  assert.ok(
    !src.includes('NODE_ENV === "test"') && !src.includes("NODE_ENV === 'test'"),
    "auth.controller must not use NODE_ENV to expose reset tokens"
  );
  assert.ok(
    src.includes("ALLOW_RESET_TOKEN_IN_RESPONSE"),
    "auth.controller must still support the explicit opt-in flag"
  );
});

test("F10: manual inventory schema accepts ADJUSTMENT/WASTAGE/RETURN", () => {
  for (const type of ["ADJUSTMENT", "WASTAGE", "RETURN"]) {
    const parsed = stockAdjustmentSchema.safeParse({
      feedTypeId: 1,
      type,
      quantity: 5,
    });
    assert.equal(parsed.success, true, `${type} should be accepted`);
  }
});

test("F10: manual inventory schema rejects PURCHASE/CONSUMPTION", () => {
  for (const type of ["PURCHASE", "CONSUMPTION"]) {
    const parsed = stockAdjustmentSchema.safeParse({
      feedTypeId: 1,
      type,
      quantity: 5,
    });
    assert.equal(parsed.success, false, `${type} must be rejected`);
  }
});

test("I/J: negative egg and mortality input rejected on create", () => {
  const base = {
    houseId: 1,
    date: new Date(),
    mortality: 0,
    feedUsedKg: 0,
    eggsCollected: 0,
  };
  assert.equal(
    createDailyRecordSchema.safeParse({ ...base, eggsCollected: -5 }).success,
    false,
    "negative eggs must be rejected"
  );
  assert.equal(
    createDailyRecordSchema.safeParse({ ...base, mortality: -2 }).success,
    false,
    "negative mortality must be rejected"
  );
  assert.equal(
    createDailyRecordSchema.safeParse({ ...base, feedUsedKg: -1 }).success,
    false,
    "negative feed must be rejected"
  );
});

test("I/J: negative values rejected on update, partial bodies allowed", () => {
  assert.equal(
    updateDailyRecordSchema.safeParse({ mortality: -1 }).success,
    false,
    "negative mortality must be rejected on update"
  );
  assert.equal(
    updateDailyRecordSchema.safeParse({ eggsCollected: -10 }).success,
    false,
    "negative eggs must be rejected on update"
  );
  assert.equal(
    updateDailyRecordSchema.safeParse({ mortality: 3 }).success,
    true,
    "partial update with only mortality must be allowed"
  );
  assert.equal(
    updateDailyRecordSchema.safeParse({ feedUsedKg: 12.5 }).success,
    true,
    "partial update with only feedUsedKg must be allowed"
  );
});

test("Corrections: schema requires field, whole non-negative value, reason", () => {
  assert.equal(
    createCorrectionSchema.safeParse({ field: "MORTALITY", correctedValue: 15, reason: "recount" }).success,
    true
  );
  assert.equal(
    createCorrectionSchema.safeParse({ field: "FEED", correctedValue: 15, reason: "x" }).success,
    false,
    "only MORTALITY/EGGS correctable via this endpoint"
  );
  assert.equal(
    createCorrectionSchema.safeParse({ field: "EGGS", correctedValue: -3, reason: "x" }).success,
    false,
    "negative corrected value rejected"
  );
  assert.equal(
    createCorrectionSchema.safeParse({ field: "EGGS", correctedValue: 12.5, reason: "x" }).success,
    false,
    "fractional corrected value rejected"
  );
  assert.equal(
    createCorrectionSchema.safeParse({ field: "EGGS", correctedValue: 10, reason: "  " }).success,
    false,
    "empty reason rejected"
  );
});
