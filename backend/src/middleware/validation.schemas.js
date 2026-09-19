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

// Finance Categories
const EXPENSE_CATEGORIES = [
  "Feed",
  "Medication",
  "Vaccines",
  "Labor/staff",
  "Transportation",
  "Electricity",
  "Water",
  "Equipment",
  "Repairs",
  "Poultry house maintenance",
  "Packaging",
  "Other",
];

const INCOME_CATEGORIES = [
  "Egg sales",
  "Bird sales",
  "Manure sales",
  "Spent/layer bird sales",
  "Other income",
];

// Customer Schemas
const createCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Customer name is required"),
  phone: z
    .string()
    .trim()
    .optional()
    .nullable(),
  email: z
    .string()
    .trim()
    .email("Please provide a valid email address")
    .optional()
    .nullable()
    .or(z.literal("")),
  address: z
    .string()
    .trim()
    .optional()
    .nullable(),
  notes: z
    .string()
    .trim()
    .optional()
    .nullable(),
  active: z.boolean().optional().default(true),
});

const updateCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Customer name is required")
    .optional(),
  phone: z
    .string()
    .trim()
    .optional()
    .nullable(),
  email: z
    .string()
    .trim()
    .email("Please provide a valid email address")
    .optional()
    .nullable()
    .or(z.literal("")),
  address: z
    .string()
    .trim()
    .optional()
    .nullable(),
  notes: z
    .string()
    .trim()
    .optional()
    .nullable(),
  active: z.boolean().optional(),
});

// Supplier Schemas
const createSupplierSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Supplier name is required"),
  phone: z
    .string()
    .trim()
    .optional()
    .nullable(),
  email: z
    .string()
    .trim()
    .email("Please provide a valid email address")
    .optional()
    .nullable()
    .or(z.literal("")),
  address: z
    .string()
    .trim()
    .optional()
    .nullable(),
  category: z
    .string()
    .trim()
    .optional()
    .nullable(),
  notes: z
    .string()
    .trim()
    .optional()
    .nullable(),
  active: z.boolean().optional().default(true),
});

const updateSupplierSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Supplier name is required")
    .optional(),
  phone: z
    .string()
    .trim()
    .optional()
    .nullable(),
  email: z
    .string()
    .trim()
    .email("Please provide a valid email address")
    .optional()
    .nullable()
    .or(z.literal("")),
  address: z
    .string()
    .trim()
    .optional()
    .nullable(),
  category: z
    .string()
    .trim()
    .optional()
    .nullable(),
  notes: z
    .string()
    .trim()
    .optional()
    .nullable(),
  active: z.boolean().optional(),
});

// Expense Schemas
const createExpenseSchema = z.object({
  houseId: z
    .number()
    .int("House ID must be a whole number")
    .positive("House ID must be greater than 0")
    .optional()
    .nullable(),
  breedId: z
    .number()
    .int("Breed ID must be a whole number")
    .positive("Breed ID must be greater than 0")
    .optional()
    .nullable(),
  supplierId: z
    .number()
    .int("Supplier ID must be a whole number")
    .positive("Supplier ID must be greater than 0")
    .optional()
    .nullable(),
  category: z
    .string()
    .trim()
    .min(1, "Category is required"),
  amount: z.coerce
    .number({
      error: "Amount must be a valid number",
    })
    .positive("Amount must be greater than 0")
    .optional()
    .nullable(),
  date: z.coerce.date({
    error: "Date must be a valid date",
  }),
  description: z
    .string()
    .trim()
    .optional()
    .nullable(),
  quantity: z.coerce
    .number()
    .positive("Quantity must be greater than 0")
    .optional()
    .nullable(),
  unit: z
    .string()
    .trim()
    .optional()
    .nullable(),
  unitPrice: z.coerce
    .number()
    .nonnegative("Unit price cannot be negative")
    .optional()
    .nullable(),
  amountPaid: z.coerce
    .number()
    .nonnegative("Amount paid cannot be negative")
    .optional()
    .nullable(),
  amountDue: z.coerce
    .number()
    .nonnegative("Amount due cannot be negative")
    .optional()
    .nullable(),
  paymentStatus: z
    .enum(["PAID", "PARTIALLY_PAID", "UNPAID"])
    .optional()
    .nullable(),
}).refine(
  (data) => data.amount || (data.quantity && data.unitPrice),
  { message: "Either amount or both quantity and unit price are required", path: ["amount"] }
);

const updateExpenseSchema = z.object({
  houseId: z
    .number()
    .int("House ID must be a whole number")
    .positive("House ID must be greater than 0")
    .optional()
    .nullable(),
  breedId: z
    .number()
    .int("Breed ID must be a whole number")
    .positive("Breed ID must be greater than 0")
    .optional()
    .nullable(),
  supplierId: z
    .number()
    .int("Supplier ID must be a whole number")
    .positive("Supplier ID must be greater than 0")
    .optional()
    .nullable(),
  category: z
    .string()
    .trim()
    .min(1, "Category is required")
    .optional(),
  amount: z.coerce
    .number({
      error: "Amount is required and must be a valid number",
    })
    .positive("Amount must be greater than 0")
    .optional(),
  date: z.coerce
    .date({
      error: "Date must be a valid date",
    })
    .optional(),
  description: z
    .string()
    .trim()
    .optional()
    .nullable(),
  quantity: z.coerce
    .number()
    .positive("Quantity must be greater than 0")
    .optional()
    .nullable(),
  unit: z
    .string()
    .trim()
    .optional()
    .nullable(),
  unitPrice: z.coerce
    .number()
    .nonnegative("Unit price cannot be negative")
    .optional()
    .nullable(),
  amountPaid: z.coerce
    .number()
    .nonnegative("Amount paid cannot be negative")
    .optional()
    .nullable(),
  amountDue: z.coerce
    .number()
    .nonnegative("Amount due cannot be negative")
    .optional()
    .nullable(),
  paymentStatus: z
    .enum(["PAID", "PARTIALLY_PAID", "UNPAID"])
    .optional()
    .nullable(),
});

// Income Schemas
const createIncomeSchema = z.object({
  houseId: z
    .number()
    .int("House ID must be a whole number")
    .positive("House ID must be greater than 0")
    .optional()
    .nullable(),
  breedId: z
    .number()
    .int("Breed ID must be a whole number")
    .positive("Breed ID must be greater than 0")
    .optional()
    .nullable(),
  customerId: z
    .number()
    .int("Customer ID must be a whole number")
    .positive("Customer ID must be greater than 0")
    .optional()
    .nullable(),
  category: z
    .string()
    .trim()
    .min(1, "Category is required"),
  amount: z.coerce
    .number({
      error: "Amount must be a valid number",
    })
    .positive("Amount must be greater than 0")
    .optional()
    .nullable(),
  date: z.coerce.date({
    error: "Date must be a valid date",
  }),
  description: z
    .string()
    .trim()
    .optional()
    .nullable(),
  quantity: z.coerce
    .number()
    .positive("Quantity must be greater than 0")
    .optional()
    .nullable(),
  unit: z
    .string()
    .trim()
    .optional()
    .nullable(),
  unitPrice: z.coerce
    .number()
    .nonnegative("Unit price cannot be negative")
    .optional()
    .nullable(),
  amountPaid: z.coerce
    .number()
    .nonnegative("Amount paid cannot be negative")
    .optional()
    .nullable(),
  amountDue: z.coerce
    .number()
    .nonnegative("Amount due cannot be negative")
    .optional()
    .nullable(),
  paymentStatus: z
    .enum(["PAID", "PARTIALLY_PAID", "UNPAID"])
    .optional()
    .nullable(),
}).refine(
  (data) => data.amount || (data.quantity && data.unitPrice),
  { message: "Either amount or both quantity and unit price are required", path: ["amount"] }
);

const updateIncomeSchema = z.object({
  houseId: z
    .number()
    .int("House ID must be a whole number")
    .positive("House ID must be greater than 0")
    .optional()
    .nullable(),
  breedId: z
    .number()
    .int("Breed ID must be a whole number")
    .positive("Breed ID must be greater than 0")
    .optional()
    .nullable(),
  customerId: z
    .number()
    .int("Customer ID must be a whole number")
    .positive("Customer ID must be greater than 0")
    .optional()
    .nullable(),
  category: z
    .string()
    .trim()
    .min(1, "Category is required")
    .optional(),
  amount: z.coerce
    .number({
      error: "Amount is required and must be a valid number",
    })
    .positive("Amount must be greater than 0")
    .optional(),
  date: z.coerce
    .date({
      error: "Date must be a valid date",
    })
    .optional(),
  description: z
    .string()
    .trim()
    .optional()
    .nullable(),
  quantity: z.coerce
    .number()
    .positive("Quantity must be greater than 0")
    .optional()
    .nullable(),
  unit: z
    .string()
    .trim()
    .optional()
    .nullable(),
  unitPrice: z.coerce
    .number()
    .nonnegative("Unit price cannot be negative")
    .optional()
    .nullable(),
  amountPaid: z.coerce
    .number()
    .nonnegative("Amount paid cannot be negative")
    .optional()
    .nullable(),
  amountDue: z.coerce
    .number()
    .nonnegative("Amount due cannot be negative")
    .optional()
    .nullable(),
  paymentStatus: z
    .enum(["PAID", "PARTIALLY_PAID", "UNPAID"])
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
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  createCustomerSchema,
  updateCustomerSchema,
  createSupplierSchema,
  updateSupplierSchema,
  createExpenseSchema,
  updateExpenseSchema,
  createIncomeSchema,
  updateIncomeSchema,
  idParamSchema,
  houseIdParamSchema,
};