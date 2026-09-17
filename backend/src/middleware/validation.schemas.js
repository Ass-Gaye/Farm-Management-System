/**
 * Active request-body schemas for the API.
 *
 * Keeping these rules separate from controllers lets every route apply the
 * same input contract before database work begins.
 */
const { z } = require("zod");

// Auth Schemas
const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please provide a valid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters long"),
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters long"),
});

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please provide a valid email address"),
  password: z
    .string()
    .min(1, "Password is required"),
});

// House Schemas
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

// Daily Record Schemas
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

// Breed Schemas
const createBreedSchema = z.object({
  houseId: z
    .number()
    .int("House ID must be a whole number")
    .positive("House ID must be greater than 0"),
  name: z
    .string()
    .trim()
    .min(1, "Breed name is required"),
  description: z
    .string()
    .trim()
    .optional()
    .nullable(),
  numberOfBirds: z
    .number()
    .int("Number of birds must be a whole number")
    .positive("Number of birds must be greater than 0"),
  dateAdded: z.coerce.date({
    error: "Date added must be a valid date",
  }).optional(),
});

const updateBreedSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Breed name is required"),
  description: z
    .string()
    .trim()
    .optional()
    .nullable(),
  numberOfBirds: z
    .number()
    .int("Number of birds must be a whole number")
    .positive("Number of birds must be greater than 0"),
  dateAdded: z.coerce.date({
    error: "Date added must be a valid date",
  }).optional(),
});

// Bird Condition Schemas
const createBirdConditionSchema = z.object({
  houseId: z
    .number()
    .int("House ID must be a whole number")
    .positive("House ID must be greater than 0"),
  breedId: z
    .number()
    .int("Breed ID must be a whole number")
    .positive("Breed ID must be greater than 0")
    .optional()
    .nullable(),
  healthy: z
    .number()
    .int("Healthy birds must be a whole number")
    .nonnegative("Healthy birds cannot be negative")
    .default(0),
  sick: z
    .number()
    .int("Sick birds must be a whole number")
    .nonnegative("Sick birds cannot be negative")
    .default(0),
  weak: z
    .number()
    .int("Weak birds must be a whole number")
    .nonnegative("Weak birds cannot be negative")
    .default(0),
  underObservation: z
    .number()
    .int("Birds under observation must be a whole number")
    .nonnegative("Birds under observation cannot be negative")
    .default(0),
  notes: z
    .string()
    .trim()
    .optional()
    .nullable(),
  recordDate: z.coerce
    .date({
      error: "Record date must be a valid date",
    })
    .optional(),
});

const updateBirdConditionSchema = z.object({
  breedId: z
    .number()
    .int("Breed ID must be a whole number")
    .positive("Breed ID must be greater than 0")
    .optional()
    .nullable(),
  healthy: z
    .number()
    .int("Healthy birds must be a whole number")
    .nonnegative("Healthy birds cannot be negative")
    .default(0),
  sick: z
    .number()
    .int("Sick birds must be a whole number")
    .nonnegative("Sick birds cannot be negative")
    .default(0),
  weak: z
    .number()
    .int("Weak birds must be a whole number")
    .nonnegative("Weak birds cannot be negative")
    .default(0),
  underObservation: z
    .number()
    .int("Birds under observation must be a whole number")
    .nonnegative("Birds under observation cannot be negative")
    .default(0),
  notes: z
    .string()
    .trim()
    .optional()
    .nullable(),
  recordDate: z.coerce
    .date({
      error: "Record date must be a valid date",
    })
    .optional(),
});

// Slaughter Plan Schemas
const createSlaughterPlanSchema = z.object({
  houseId: z
    .number()
    .int("House ID must be a whole number")
    .positive("House ID must be greater than 0"),
  breedId: z
    .number()
    .int("Breed ID must be a whole number")
    .positive("Breed ID must be greater than 0")
    .optional()
    .nullable(),
  numberOfBirds: z
    .number()
    .int("Number of birds must be a whole number")
    .positive("Number of birds must be greater than 0"),
  placementDate: z.coerce.date({
    error: "Placement date must be a valid date",
  }),
  expectedSlaughterDate: z.coerce.date({
    error: "Expected slaughter date must be a valid date",
  }),
  status: z
    .string()
    .trim()
    .optional()
    .default("Upcoming"),
  notes: z
    .string()
    .trim()
    .optional()
    .nullable(),
});

const updateSlaughterPlanSchema = z.object({
  breedId: z
    .number()
    .int("Breed ID must be a whole number")
    .positive("Breed ID must be greater than 0")
    .optional()
    .nullable(),
  numberOfBirds: z
    .number()
    .int("Number of birds must be a whole number")
    .positive("Number of birds must be greater than 0")
    .optional(),
  placementDate: z.coerce
    .date({
      error: "Placement date must be a valid date",
    })
    .optional(),
  expectedSlaughterDate: z.coerce
    .date({
      error: "Expected slaughter date must be a valid date",
    })
    .optional(),
  status: z
    .string()
    .trim()
    .optional(),
  notes: z
    .string()
    .trim()
    .optional()
    .nullable(),
});

// Param Schemas
const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const houseIdParamSchema = z.object({
  houseId: z.coerce.number().int().positive(),
});

module.exports = {
  registerSchema,
  loginSchema,
  createHouseSchema,
  createDailyRecordSchema,
  updateDailyRecordSchema,
  createBreedSchema,
  updateBreedSchema,
  createBirdConditionSchema,
  updateBirdConditionSchema,
  createSlaughterPlanSchema,
  updateSlaughterPlanSchema,
  idParamSchema,
  houseIdParamSchema,
};