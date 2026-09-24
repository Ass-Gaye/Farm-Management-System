/**
 * Active request-body schemas for the API.
 *
 * Keeping these rules separate from controllers lets every route apply the
 * same input contract before database work begins.
 */
const { z } = require("zod");

// Auth Schemas
const passwordRule = (fieldLabel = "Password") =>
  z
    .string()
    .min(6, `${fieldLabel} must be at least 6 characters long`)
    .max(72, `${fieldLabel} must not exceed 72 characters (bcrypt limit)`)
    .refine((val) => /[A-Za-z]/.test(val) && /[0-9]/.test(val), {
      message: `${fieldLabel} must contain at least one letter and one number`,
    });

const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please provide a valid email address"),
  password: passwordRule("Password"),
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters long")
    .max(100, "Name must not exceed 100 characters"),
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

const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").optional(),
  email: z.string().trim().email("Please provide a valid email address").optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required").max(72),
  newPassword: passwordRule("New password"),
});

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please provide a valid email address"),
});

const resetPasswordSchema = z.object({
  token: z
    .string()
    .min(10, "Password reset token is required"),
  newPassword: passwordRule("New password"),
});

// House Schemas
const createHouseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "House name must be at least 2 characters"),
  address: z
    .string()
    .trim()
    .min(2, "Address / Location is required")
    .max(300, "Address must not exceed 300 characters"),
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
  flockId: z
    .number()
    .int("Flock ID must be a whole number")
    .positive("Flock ID must be greater than 0")
    .optional()
    .nullable(),
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
  avgWeightGrams: z
    .number()
    .nonnegative("Average weight cannot be negative")
    .optional()
    .nullable(),
  feedTypeId: z
    .number()
    .int("Feed type ID must be a whole number")
    .positive("Feed type ID must be greater than 0")
    .optional()
    .nullable(),
});

const updateDailyRecordSchema = z.object({
  flockId: z
    .number()
    .int("Flock ID must be a whole number")
    .positive("Flock ID must be greater than 0")
    .optional()
    .nullable(),
  date: z.coerce
    .date({
      error: "Date must be a valid date",
    })
    .optional()
    .nullable(),
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
  avgWeightGrams: z
    .number()
    .nonnegative("Average weight cannot be negative")
    .optional()
    .nullable(),
  feedTypeId: z
    .number()
    .int("Feed type ID must be a whole number")
    .positive("Feed type ID must be greater than 0")
    .optional()
    .nullable(),
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

// Flock Schemas
const createFlockSchema = z.object({
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
  name: z
    .string()
    .trim()
    .min(1, "Flock name is required"),
  batchNumber: z
    .string()
    .trim()
    .optional()
    .nullable(),
  purpose: z
    .enum(["BROILER", "LAYER", "BREEDER", "DUAL_PURPOSE", "OTHER"])
    .default("BROILER"),
  birdsPlaced: z
    .number()
    .int("Birds placed must be a whole number")
    .positive("Birds placed must be greater than 0"),
  placementDate: z.coerce.date({
    error: "Placement date must be a valid date",
  }),
  expectedMarketDate: z.coerce
    .date({
      error: "Expected market date must be a valid date",
    })
    .optional()
    .nullable(),
  targetWeightKg: z.coerce
    .number()
    .positive("Target weight must be greater than 0")
    .optional()
    .nullable(),
  status: z
    .enum(["ACTIVE", "COMPLETED", "SOLD", "SLAUGHTERED", "ARCHIVED"])
    .default("ACTIVE"),
  notes: z
    .string()
    .trim()
    .optional()
    .nullable(),
});

const updateFlockSchema = z.object({
  houseId: z
    .number()
    .int("House ID must be a whole number")
    .positive("House ID must be greater than 0")
    .optional(),
  breedId: z
    .number()
    .int("Breed ID must be a whole number")
    .positive("Breed ID must be greater than 0")
    .optional()
    .nullable(),
  name: z
    .string()
    .trim()
    .min(1, "Flock name is required")
    .optional(),
  batchNumber: z
    .string()
    .trim()
    .optional()
    .nullable(),
  purpose: z
    .enum(["BROILER", "LAYER", "BREEDER", "DUAL_PURPOSE", "OTHER"])
    .optional(),
  birdsPlaced: z
    .number()
    .int("Birds placed must be a whole number")
    .positive("Birds placed must be greater than 0")
    .optional(),
  placementDate: z.coerce
    .date({
      error: "Placement date must be a valid date",
    })
    .optional(),
  expectedMarketDate: z.coerce
    .date({
      error: "Expected market date must be a valid date",
    })
    .optional()
    .nullable(),
  targetWeightKg: z.coerce
    .number()
    .positive("Target weight must be greater than 0")
    .optional()
    .nullable(),
  status: z
    .enum(["ACTIVE", "COMPLETED", "SOLD", "SLAUGHTERED", "ARCHIVED"])
    .optional(),
  notes: z
    .string()
    .trim()
    .optional()
    .nullable(),
});

// Vaccination Schemas
const createVaccinationSchema = z.object({
  flockId: z
    .number()
    .int("Flock ID must be a whole number")
    .positive("Flock ID must be greater than 0"),
  vaccineName: z
    .string()
    .trim()
    .min(1, "Vaccine name is required"),
  disease: z
    .string()
    .trim()
    .optional()
    .nullable(),
  targetAgeDays: z
    .number()
    .int("Target age days must be a whole number")
    .nonnegative("Target age days cannot be negative")
    .optional()
    .nullable(),
  scheduledDate: z.coerce.date({
    error: "Scheduled date must be a valid date",
  }),
  administeredDate: z.coerce
    .date({
      error: "Administered date must be a valid date",
    })
    .optional()
    .nullable(),
  status: z
    .enum(["PENDING", "COMPLETED", "MISSED"])
    .default("PENDING"),
  dosage: z
    .string()
    .trim()
    .optional()
    .nullable(),
  administeredBy: z
    .string()
    .trim()
    .optional()
    .nullable(),
  cost: z.coerce
    .number()
    .nonnegative("Cost cannot be negative")
    .optional()
    .nullable(),
  notes: z
    .string()
    .trim()
    .optional()
    .nullable(),
});

const updateVaccinationSchema = z.object({
  vaccineName: z
    .string()
    .trim()
    .min(1, "Vaccine name is required")
    .optional(),
  disease: z
    .string()
    .trim()
    .optional()
    .nullable(),
  targetAgeDays: z
    .number()
    .int("Target age days must be a whole number")
    .nonnegative("Target age days cannot be negative")
    .optional()
    .nullable(),
  scheduledDate: z.coerce
    .date({
      error: "Scheduled date must be a valid date",
    })
    .optional(),
  administeredDate: z.coerce
    .date({
      error: "Administered date must be a valid date",
    })
    .optional()
    .nullable(),
  status: z
    .enum(["PENDING", "COMPLETED", "MISSED"])
    .optional(),
  dosage: z
    .string()
    .trim()
    .optional()
    .nullable(),
  administeredBy: z
    .string()
    .trim()
    .optional()
    .nullable(),
  cost: z.coerce
    .number()
    .nonnegative("Cost cannot be negative")
    .optional()
    .nullable(),
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
  flockId: z
    .number()
    .int("Flock ID must be a whole number")
    .positive("Flock ID must be greater than 0")
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
  feedTypeId: z
    .number()
    .int("Feed type ID must be a whole number")
    .positive("Feed type ID must be greater than 0")
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
  flockId: z
    .number()
    .int("Flock ID must be a whole number")
    .positive("Flock ID must be greater than 0")
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
  feedTypeId: z
    .number()
    .int("Feed type ID must be a whole number")
    .positive("Feed type ID must be greater than 0")
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
  flockId: z
    .number()
    .int("Flock ID must be a whole number")
    .positive("Flock ID must be greater than 0")
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
  flockId: z
    .number()
    .int("Flock ID must be a whole number")
    .positive("Flock ID must be greater than 0")
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

// Feed Type Schemas
const createFeedTypeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Feed type name is required"),
  category: z
    .string()
    .trim()
    .optional()
    .default("FEED"),
  description: z
    .string()
    .trim()
    .optional()
    .nullable(),
  unit: z
    .enum(["kg", "bags"], {
      error: "Feed unit must be either kg or bags",
    })
    .transform((value) => value.trim().toLowerCase())
    .optional()
    .default("kg"),
  bagWeightKg: z.coerce
    .number()
    .positive("Bag weight must be greater than 0")
    .optional()
    .default(50),
  minimumStock: z.coerce
    .number()
    .nonnegative("Minimum stock cannot be negative")
    .optional()
    .default(0),
  currentStock: z.coerce
    .number()
    .nonnegative("Current stock cannot be negative")
    .optional()
    .default(0),
  unitCost: z.coerce
    .number()
    .nonnegative("Unit cost cannot be negative")
    .optional()
    .default(0),
  active: z.boolean().optional().default(true),
}).refine(
  (data) => {
    if (data.unit === "bags") {
      return data.bagWeightKg !== undefined && data.bagWeightKg !== null && Number(data.bagWeightKg) > 0;
    }
    return true;
  },
  {
    message: "A valid bag weight (greater than 0 kg) is required when unit is bags",
    path: ["bagWeightKg"],
  }
);

const updateFeedTypeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Feed type name is required")
    .optional(),
  category: z
    .string()
    .trim()
    .optional(),
  description: z
    .string()
    .trim()
    .optional()
    .nullable(),
  unit: z
    .enum(["kg", "bags"], {
      error: "Feed unit must be either kg or bags",
    })
    .transform((value) => value.trim().toLowerCase())
    .optional(),
  bagWeightKg: z.coerce
    .number()
    .positive("Bag weight must be greater than 0")
    .optional()
    .nullable(),
  minimumStock: z.coerce
    .number()
    .nonnegative("Minimum stock cannot be negative")
    .optional(),
  unitCost: z.coerce
    .number()
    .nonnegative("Unit cost cannot be negative")
    .optional(),
  active: z.boolean().optional(),
}).refine(
  (data) => {
    if (data.unit === "bags" && data.bagWeightKg !== undefined) {
      return data.bagWeightKg !== null && Number(data.bagWeightKg) > 0;
    }
    return true;
  },
  {
    message: "A valid bag weight (greater than 0 kg) is required when unit is bags",
    path: ["bagWeightKg"],
  }
);

// Stock Adjustment Schema
const stockAdjustmentSchema = z.object({
  feedTypeId: z
    .number()
    .int("Feed type ID must be a whole number")
    .positive("Feed type ID must be greater than 0"),
  type: z
    .enum(["ADJUSTMENT", "WASTAGE", "RETURN", "PURCHASE", "CONSUMPTION"])
    .default("ADJUSTMENT"),
  quantity: z.coerce
    .number({ error: "Quantity is required" })
    .refine((val) => val !== 0, { message: "Adjustment quantity cannot be zero" }),
  unit: z
    .string()
    .trim()
    .optional(),
  reason: z
    .string()
    .trim()
    .optional()
    .nullable(),
  date: z.coerce
    .date({ error: "Date must be a valid date" })
    .optional(),
  houseId: z
    .number()
    .int()
    .positive()
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

const flockIdParamSchema = z.object({
  flockId: z.coerce.number().int().positive(),
});

const depopulationParamsSchema = z.object({
  flockId: z.coerce.number().int().positive(),
  id: z.coerce.number().int().positive(),
});

const DEPOPULATION_REASONS = [
  "SOLD",
  "SLAUGHTERED",
  "CULLED",
  "TRANSFERRED",
  "OTHER",
];

const createDepopulationEventSchema = z.object({
  flockId: z.coerce.number().int().positive("Flock ID must be a positive integer").optional(),
  quantity: z
    .number({ invalid_type_error: "Quantity must be a number" })
    .int("Quantity must be a whole number")
    .positive("Quantity must be greater than 0"),
  reason: z.enum(DEPOPULATION_REASONS, {
    error: `Reason must be one of: ${DEPOPULATION_REASONS.join(", ")}`,
  }),
  date: z
    .union([
      z.string().refine((val) => !isNaN(Date.parse(val)), "Date must be a valid ISO date"),
      z.date(),
    ]),
  notes: z.string().max(500, "Notes cannot exceed 500 characters").optional().nullable(),
  incomeId: z.coerce.number().int().positive().optional().nullable(),
});

const updateDepopulationEventSchema = z.object({
  quantity: z
    .number({ invalid_type_error: "Quantity must be a number" })
    .int("Quantity must be a whole number")
    .positive("Quantity must be greater than 0")
    .optional(),
  reason: z
    .enum(DEPOPULATION_REASONS, {
      error: `Reason must be one of: ${DEPOPULATION_REASONS.join(", ")}`,
    })
    .optional(),
  date: z
    .union([
      z.string().refine((val) => !isNaN(Date.parse(val)), "Date must be a valid ISO date"),
      z.date(),
    ])
    .optional(),
  notes: z.string().max(500, "Notes cannot exceed 500 characters").optional().nullable(),
  incomeId: z.coerce.number().int().positive().optional().nullable(),
});

module.exports = {
  passwordRule,
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createHouseSchema,
  createDailyRecordSchema,
  updateDailyRecordSchema,
  createBreedSchema,
  updateBreedSchema,
  createBirdConditionSchema,
  updateBirdConditionSchema,
  createSlaughterPlanSchema,
  updateSlaughterPlanSchema,
  createFlockSchema,
  updateFlockSchema,
  createVaccinationSchema,
  updateVaccinationSchema,
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
  createFeedTypeSchema,
  updateFeedTypeSchema,
  stockAdjustmentSchema,
  idParamSchema,
  houseIdParamSchema,
  flockIdParamSchema,
  depopulationParamsSchema,
  DEPOPULATION_REASONS,
  createDepopulationEventSchema,
  updateDepopulationEventSchema,
};