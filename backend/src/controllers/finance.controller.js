const prisma = require("../lib/prisma");

/**
 * Validates that an optional houseId and optional breedId belong to the authenticated user.
 *
 * @param {number} userId Authenticated user ID
 * @param {number|null|undefined} houseId Optional house ID
 * @param {number|null|undefined} breedId Optional breed ID
 * @returns {Promise<{ valid: boolean, error?: string, status?: number }>}
 */
const validateOwnership = async (userId, houseId, breedId) => {
  if (houseId) {
    const house = await prisma.poultryHouse.findFirst({
      where: {
        id: Number(houseId),
        userId: Number(userId),
      },
    });

    if (!house) {
      return {
        valid: false,
        status: 404,
        error: "Poultry house not found or does not belong to your farm",
      };
    }
  }

  if (breedId) {
    const breed = await prisma.breed.findFirst({
      where: {
        id: Number(breedId),
        house: {
          userId: Number(userId),
          ...(houseId ? { id: Number(houseId) } : {}),
        },
      },
    });

    if (!breed) {
      return {
        valid: false,
        status: 404,
        error: "Flock/breed record not found or does not belong to your poultry house",
      };
    }
  }

  return { valid: true };
};

// ==========================================
// EXPENSE CONTROLLER METHODS
// ==========================================

/**
 * Creates a new expense record for the authenticated user.
 */
const createExpense = async (req, res, next) => {
  try {
    const { houseId, breedId, category, amount, date, description } = req.body;

    const check = await validateOwnership(req.user.id, houseId, breedId);
    if (!check.valid) {
      return res.status(check.status).json({
        success: false,
        message: check.error,
      });
    }

    const expense = await prisma.expense.create({
      data: {
        userId: req.user.id,
        houseId: houseId ? Number(houseId) : null,
        breedId: breedId ? Number(breedId) : null,
        category: category.trim(),
        amount: Number(amount),
        date: new Date(date),
        description: description ? description.trim() : null,
      },
      include: {
        house: {
          select: { id: true, name: true },
        },
        breed: {
          select: { id: true, name: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: "Expense recorded successfully",
      data: {
        ...expense,
        amount: Number(expense.amount),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves all expenses belonging to the authenticated user.
 */
const getExpenses = async (req, res, next) => {
  try {
    const { houseId, category, startDate, endDate } = req.query;

    const where = {
      userId: req.user.id,
    };

    if (houseId) {
      where.houseId = Number(houseId);
    }

    if (category) {
      where.category = String(category);
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        where.date.lte = new Date(endDate);
      }
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        house: {
          select: { id: true, name: true },
        },
        breed: {
          select: { id: true, name: true },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    res.json({
      success: true,
      data: expenses.map((e) => ({
        ...e,
        amount: Number(e.amount),
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves a single expense record by ID, verifying ownership.
 */
const getExpenseById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const expense = await prisma.expense.findFirst({
      where: {
        id: Number(id),
        userId: req.user.id,
      },
      include: {
        house: {
          select: { id: true, name: true },
        },
        breed: {
          select: { id: true, name: true },
        },
      },
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense record not found",
      });
    }

    res.json({
      success: true,
      data: {
        ...expense,
        amount: Number(expense.amount),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates an existing expense record, verifying ownership.
 */
const updateExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { houseId, breedId, category, amount, date, description } = req.body;

    const existing = await prisma.expense.findFirst({
      where: {
        id: Number(id),
        userId: req.user.id,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Expense record not found",
      });
    }

    const check = await validateOwnership(req.user.id, houseId, breedId);
    if (!check.valid) {
      return res.status(check.status).json({
        success: false,
        message: check.error,
      });
    }

    const updated = await prisma.expense.update({
      where: {
        id: Number(id),
      },
      data: {
        houseId: houseId !== undefined ? (houseId ? Number(houseId) : null) : existing.houseId,
        breedId: breedId !== undefined ? (breedId ? Number(breedId) : null) : existing.breedId,
        category: category !== undefined ? category.trim() : existing.category,
        amount: amount !== undefined ? Number(amount) : existing.amount,
        date: date ? new Date(date) : existing.date,
        description: description !== undefined ? (description ? description.trim() : null) : existing.description,
      },
      include: {
        house: {
          select: { id: true, name: true },
        },
        breed: {
          select: { id: true, name: true },
        },
      },
    });

    res.json({
      success: true,
      message: "Expense updated successfully",
      data: {
        ...updated,
        amount: Number(updated.amount),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deletes an existing expense record, verifying ownership.
 */
const deleteExpense = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.expense.findFirst({
      where: {
        id: Number(id),
        userId: req.user.id,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Expense record not found",
      });
    }

    await prisma.expense.delete({
      where: {
        id: Number(id),
      },
    });

    res.json({
      success: true,
      message: "Expense record deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// INCOME CONTROLLER METHODS
// ==========================================

/**
 * Creates a new income record for the authenticated user.
 */
const createIncome = async (req, res, next) => {
  try {
    const { houseId, breedId, category, amount, date, description } = req.body;

    const check = await validateOwnership(req.user.id, houseId, breedId);
    if (!check.valid) {
      return res.status(check.status).json({
        success: false,
        message: check.error,
      });
    }

    const income = await prisma.income.create({
      data: {
        userId: req.user.id,
        houseId: houseId ? Number(houseId) : null,
        breedId: breedId ? Number(breedId) : null,
        category: category.trim(),
        amount: Number(amount),
        date: new Date(date),
        description: description ? description.trim() : null,
      },
      include: {
        house: {
          select: { id: true, name: true },
        },
        breed: {
          select: { id: true, name: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: "Income recorded successfully",
      data: {
        ...income,
        amount: Number(income.amount),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves all income records belonging to the authenticated user.
 */
const getIncome = async (req, res, next) => {
  try {
    const { houseId, category, startDate, endDate } = req.query;

    const where = {
      userId: req.user.id,
    };

    if (houseId) {
      where.houseId = Number(houseId);
    }

    if (category) {
      where.category = String(category);
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        where.date.lte = new Date(endDate);
      }
    }

    const incomeList = await prisma.income.findMany({
      where,
      include: {
        house: {
          select: { id: true, name: true },
        },
        breed: {
          select: { id: true, name: true },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    res.json({
      success: true,
      data: incomeList.map((i) => ({
        ...i,
        amount: Number(i.amount),
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves a single income record by ID, verifying ownership.
 */
const getIncomeById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const income = await prisma.income.findFirst({
      where: {
        id: Number(id),
        userId: req.user.id,
      },
      include: {
        house: {
          select: { id: true, name: true },
        },
        breed: {
          select: { id: true, name: true },
        },
      },
    });

    if (!income) {
      return res.status(404).json({
        success: false,
        message: "Income record not found",
      });
    }

    res.json({
      success: true,
      data: {
        ...income,
        amount: Number(income.amount),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates an existing income record, verifying ownership.
 */
const updateIncome = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { houseId, breedId, category, amount, date, description } = req.body;

    const existing = await prisma.income.findFirst({
      where: {
        id: Number(id),
        userId: req.user.id,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Income record not found",
      });
    }

    const check = await validateOwnership(req.user.id, houseId, breedId);
    if (!check.valid) {
      return res.status(check.status).json({
        success: false,
        message: check.error,
      });
    }

    const updated = await prisma.income.update({
      where: {
        id: Number(id),
      },
      data: {
        houseId: houseId !== undefined ? (houseId ? Number(houseId) : null) : existing.houseId,
        breedId: breedId !== undefined ? (breedId ? Number(breedId) : null) : existing.breedId,
        category: category !== undefined ? category.trim() : existing.category,
        amount: amount !== undefined ? Number(amount) : existing.amount,
        date: date ? new Date(date) : existing.date,
        description: description !== undefined ? (description ? description.trim() : null) : existing.description,
      },
      include: {
        house: {
          select: { id: true, name: true },
        },
        breed: {
          select: { id: true, name: true },
        },
      },
    });

    res.json({
      success: true,
      message: "Income updated successfully",
      data: {
        ...updated,
        amount: Number(updated.amount),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deletes an existing income record, verifying ownership.
 */
const deleteIncome = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.income.findFirst({
      where: {
        id: Number(id),
        userId: req.user.id,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Income record not found",
      });
    }

    await prisma.income.delete({
      where: {
        id: Number(id),
      },
    });

    res.json({
      success: true,
      message: "Income record deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// FINANCIAL OVERVIEW & SUMMARY
// ==========================================

/**
 * Retrieves aggregate financial KPI metrics for the farm / user.
 */
const getFinancialSummary = async (req, res, next) => {
  try {
    const { houseId } = req.query;
    const userId = req.user.id;

    const whereBase = {
      userId,
      ...(houseId ? { houseId: Number(houseId) } : {}),
    };

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    const dayOfWeek = now.getDay();
    const diffToMonday = (dayOfWeek + 6) % 7; // Monday as start of week
    startOfWeek.setDate(now.getDate() - diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const [
      allExpenses,
      allIncome,
      monthExpenses,
      monthIncome,
      weekExpenses,
      weekIncome,
    ] = await Promise.all([
      prisma.expense.findMany({
        where: whereBase,
        select: { amount: true },
      }),
      prisma.income.findMany({
        where: whereBase,
        select: { amount: true },
      }),
      prisma.expense.findMany({
        where: {
          ...whereBase,
          date: { gte: startOfMonth },
        },
        select: { amount: true },
      }),
      prisma.income.findMany({
        where: {
          ...whereBase,
          date: { gte: startOfMonth },
        },
        select: { amount: true },
      }),
      prisma.expense.findMany({
        where: {
          ...whereBase,
          date: { gte: startOfWeek },
        },
        select: { amount: true },
      }),
      prisma.income.findMany({
        where: {
          ...whereBase,
          date: { gte: startOfWeek },
        },
        select: { amount: true },
      }),
    ]);

    const totalExpenses = allExpenses.reduce((sum, item) => sum + Number(item.amount), 0);
    const totalIncome = allIncome.reduce((sum, item) => sum + Number(item.amount), 0);
    const netCashFlow = totalIncome - totalExpenses;

    const monthlyExpenses = monthExpenses.reduce((sum, item) => sum + Number(item.amount), 0);
    const monthlyIncome = monthIncome.reduce((sum, item) => sum + Number(item.amount), 0);

    const weeklyExpenses = weekExpenses.reduce((sum, item) => sum + Number(item.amount), 0);
    const weeklyIncome = weekIncome.reduce((sum, item) => sum + Number(item.amount), 0);

    res.json({
      success: true,
      data: {
        currency: "GMD",
        totalIncome,
        totalExpenses,
        netCashFlow,
        estimatedNet: netCashFlow,
        monthlyIncome,
        monthlyExpenses,
        weeklyIncome,
        weeklyExpenses,
        expenseCount: allExpenses.length,
        incomeCount: allIncome.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// UNIFIED FINANCIAL TRANSACTIONS
// ==========================================

/**
 * Retrieves a combined list of income and expense transactions.
 * Supports filtering by type, category, date range, houseId, and search query.
 */
const getFinancialTransactions = async (req, res, next) => {
  try {
    const {
      type, // 'all' | 'expense' | 'income'
      category,
      houseId,
      startDate,
      endDate,
      search,
      sortOrder = "desc",
    } = req.query;

    const userId = req.user.id;

    const baseWhere = {
      userId,
      ...(houseId ? { houseId: Number(houseId) } : {}),
      ...(category ? { category: String(category) } : {}),
    };

    if (startDate || endDate) {
      baseWhere.date = {};
      if (startDate) {
        baseWhere.date.gte = new Date(startDate);
      }
      if (endDate) {
        baseWhere.date.lte = new Date(endDate);
      }
    }

    let expenses = [];
    let income = [];

    if (!type || type === "all" || type === "expense") {
      expenses = await prisma.expense.findMany({
        where: baseWhere,
        include: {
          house: { select: { id: true, name: true } },
          breed: { select: { id: true, name: true } },
        },
      });
    }

    if (!type || type === "all" || type === "income") {
      income = await prisma.income.findMany({
        where: baseWhere,
        include: {
          house: { select: { id: true, name: true } },
          breed: { select: { id: true, name: true } },
        },
      });
    }

    const unified = [
      ...expenses.map((e) => ({
        id: e.id,
        type: "Expense",
        category: e.category,
        amount: Number(e.amount),
        date: e.date,
        description: e.description,
        houseId: e.houseId,
        house: e.house,
        breedId: e.breedId,
        breed: e.breed,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      })),
      ...income.map((i) => ({
        id: i.id,
        type: "Income",
        category: i.category,
        amount: Number(i.amount),
        date: i.date,
        description: i.description,
        houseId: i.houseId,
        house: i.house,
        breedId: i.breedId,
        breed: i.breed,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
      })),
    ];

    // Optional text search filter
    let filtered = unified;
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((t) => {
        const cat = t.category.toLowerCase();
        const desc = (t.description || "").toLowerCase();
        const houseName = (t.house?.name || "").toLowerCase();
        return cat.includes(q) || desc.includes(q) || houseName.includes(q);
      });
    }

    // Sort
    filtered.sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
    });

    res.json({
      success: true,
      data: filtered,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// FINANCIAL REPORTS & BREAKDOWNS
// ==========================================

/**
 * Retrieves breakdown reports:
 * - Category breakdowns for expenses and income
 * - Monthly trends for income, expenses, and net cash flow
 */
const getFinancialReports = async (req, res, next) => {
  try {
    const { houseId } = req.query;
    const userId = req.user.id;

    const whereBase = {
      userId,
      ...(houseId ? { houseId: Number(houseId) } : {}),
    };

    const [expenses, income] = await Promise.all([
      prisma.expense.findMany({
        where: whereBase,
        orderBy: { date: "asc" },
      }),
      prisma.income.findMany({
        where: whereBase,
        orderBy: { date: "asc" },
      }),
    ]);

    // 1. Expense Breakdown by Category
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const expenseCategoryMap = {};
    for (const e of expenses) {
      const amt = Number(e.amount);
      if (!expenseCategoryMap[e.category]) {
        expenseCategoryMap[e.category] = { category: e.category, total: 0, count: 0 };
      }
      expenseCategoryMap[e.category].total += amt;
      expenseCategoryMap[e.category].count += 1;
    }
    const expenseBreakdown = Object.values(expenseCategoryMap).map((cat) => ({
      ...cat,
      percentage: totalExpenses > 0 ? Number(((cat.total / totalExpenses) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.total - a.total);

    // 2. Income Breakdown by Category
    const totalIncome = income.reduce((sum, i) => sum + Number(i.amount), 0);
    const incomeCategoryMap = {};
    for (const i of income) {
      const amt = Number(i.amount);
      if (!incomeCategoryMap[i.category]) {
        incomeCategoryMap[i.category] = { category: i.category, total: 0, count: 0 };
      }
      incomeCategoryMap[i.category].total += amt;
      incomeCategoryMap[i.category].count += 1;
    }
    const incomeBreakdown = Object.values(incomeCategoryMap).map((cat) => ({
      ...cat,
      percentage: totalIncome > 0 ? Number(((cat.total / totalIncome) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.total - a.total);

    // 3. Monthly Trends
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    const monthlyMap = {};

    for (const item of income) {
      const d = new Date(item.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyMap[key]) {
        monthlyMap[key] = {
          key,
          year: d.getFullYear(),
          monthIndex: d.getMonth(),
          monthLabel: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
          income: 0,
          expenses: 0,
          netCashFlow: 0,
        };
      }
      monthlyMap[key].income += Number(item.amount);
    }

    for (const item of expenses) {
      const d = new Date(item.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyMap[key]) {
        monthlyMap[key] = {
          key,
          year: d.getFullYear(),
          monthIndex: d.getMonth(),
          monthLabel: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
          income: 0,
          expenses: 0,
          netCashFlow: 0,
        };
      }
      monthlyMap[key].expenses += Number(item.amount);
    }

    const monthlyTrends = Object.values(monthlyMap)
      .map((m) => ({
        ...m,
        netCashFlow: m.income - m.expenses,
      }))
      .sort((a, b) => a.key.localeCompare(b.key));

    res.json({
      success: true,
      data: {
        currency: "GMD",
        totalIncome,
        totalExpenses,
        netCashFlow: totalIncome - totalExpenses,
        estimatedNet: totalIncome - totalExpenses,
        expenseBreakdown,
        incomeBreakdown,
        monthlyTrends,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  createIncome,
  getIncome,
  getIncomeById,
  updateIncome,
  deleteIncome,
  getFinancialSummary,
  getFinancialTransactions,
  getFinancialReports,
};
