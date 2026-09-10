/**
 * Active request-body schemas for the API.
 *
 * Keeping these rules separate from controllers lets every route apply the
 * same input contract before database work begins.
 */
const { z } = require("zod");

const createHouseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "House name must be at least 2 characters"),

  birdsPlaced: z
    .number()
    .int("Number of birds must be a whole number")
    .positive("Number of birds must be greater than 0"),

  createdAt: z.coerce.date({
    error: "Created date must be a valid date",
  }),

});

const createDailyRecordSchema = z.object({
  houseId: z
    .number()
    .int("House ID must be a whole number")
    .positive("House ID must be greater than 0"),

  date: z.coerce.date({
    error: "Date must be a valid date",
  }),

  mortality: z
    .number()
    .int("Mortality must be a whole number")
    .nonnegative("Mortality cannot be negative"),

  feedUsedKg: z
    .number()
    .nonnegative("Feed used cannot be negative"),

  eggsCollected: z
    .number()
    .int("Eggs collected must be a whole number")
    .nonnegative("Eggs collected cannot be negative"),
});


const updateDailyRecordSchema = z.object({
  date: z.coerce.date({
    error: "Date must be a valid date",
  }),

  mortality: z
    .number()
    .int("Mortality must be a whole number")
    .nonnegative("Mortality cannot be negative"),

  feedUsedKg: z
    .number()
    .nonnegative("Feed used cannot be negative"),

  eggsCollected: z
    .number()
    .int("Eggs collected must be a whole number")
    .nonnegative("Eggs collected cannot be negative"),
});

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const houseIdParamSchema = z.object({
  houseId: z.coerce.number().int().positive(),
});



module.exports = {
  createHouseSchema,
  createDailyRecordSchema,
  updateDailyRecordSchema,
  idParamSchema,
  houseIdParamSchema,
};