const prisma = require("../lib/prisma");
// Domain logic lives in services; re-exported here for backward compatibility.
const { validateOwnership, computePaymentState } = require("../services/finance.service");
const { convertToFeedUnit } = require("../services/feed-unit.service");


// ==========================================
// EXPENSE CONTROLLER METHODS
// ==========================================

/**
 * Creates a new expense record for the authenticated user.
 */
const createExpense = async (req, res, next) => {
  try {
    const {
      houseId,
      breedId,
      supplierId,
      feedTypeId,
      category,
      amount,
      date,
      description,
      quantity,
      unit,
      unitPrice,
      amountPaid,
      paymentStatus,
      flockId,
    } = req.body;

    const check = await validateOwnership(req.user.id, houseId, breedId, null, supplierId, feedTypeId, flockId);
    if (!check.valid) {
      return res.status(check.status).json({
        success: false,
        message: check.error,
      });
    }

    // Auto-derive total if quantity and unitPrice provided without explicit amount
    let finalAmount = amount;
    if ((finalAmount === undefined || finalAmount === null) && quantity && unitPrice) {
      finalAmount = Number((Number(quantity) * Number(unitPrice)).toFixed(2));
    }

    const payState = computePaymentState(finalAmount, amountPaid, paymentStatus);

    const expense = await prisma.$transaction(
      async (tx) => {
        let feedType = null;
        if (feedTypeId) {
          feedType = await tx.feedType.findUnique({
            where: { id: Number(feedTypeId) },
          });
        }

        const exp = await tx.expense.create({
          data: {
            userId: req.user.id,
            houseId: houseId ? Number(houseId) : null,
            flockId: flockId ? Number(flockId) : null,
            breedId: breedId ? Number(breedId) : null,
            supplierId: supplierId ? Number(supplierId) : null,
            feedTypeId: feedTypeId ? Number(feedTypeId) : null,
            category: category.trim(),
            amount: payState.amount,
            date: new Date(date),
            description: description ? description.trim() : null,
            quantity: quantity !== undefined && quantity !== null && quantity !== "" ? Number(quantity) : null,
            unit: unit ? unit.trim() : (feedType ? feedType.unit : null),
            unitPrice: unitPrice !== undefined && unitPrice !== null && unitPrice !== "" ? Number(unitPrice) : null,
            amountPaid: payState.amountPaid,
            amountDue: payState.amountDue,
            paymentStatus: payState.paymentStatus,
          },
          include: {
            house: {
              select: { id: true, name: true },
            },
            flock: {
              select: { id: true, name: true, purpose: true },
            },
            breed: {
              select: { id: true, name: true },
            },
            supplier: {
              select: { id: true, name: true, phone: true, category: true },
            },
            feedType: {
              select: { id: true, name: true, unit: true, bagWeightKg: true },
            },
          },
        });

        // If feed purchase: increase inventory and log movement
        if (feedType && quantity && Number(quantity) > 0) {
          const purchaseQty = convertToFeedUnit(Number(quantity), unit, feedType);
          const currentStock = Number(feedType.currentStock);
          const newStock = currentStock + purchaseQty;
          const effectiveUnitCost = purchaseQty > 0 ? Number((payState.amount / purchaseQty).toFixed(2)) : Number(feedType.unitCost);

          await tx.feedType.update({
            where: { id: feedType.id },
            data: {
              currentStock: newStock,
              unitCost: effectiveUnitCost > 0 ? effectiveUnitCost : feedType.unitCost,
            },
          });

          await tx.inventoryMovement.create({
            data: {
              userId: req.user.id,
              feedTypeId: feedType.id,
              houseId: houseId ? Number(houseId) : null,
              expenseId: exp.id,
              type: "PURCHASE",
              quantity: purchaseQty,
              unit: feedType.unit,
              unitCost: effectiveUnitCost,
              totalCost: payState.amount,
              balanceAfter: newStock,
              date: new Date(date),
              reason: exp.supplier ? `Feed purchase from ${exp.supplier.name}` : "Feed purchase",
            },
          });
        }

        return exp;
      },
      {
        maxWait: 15000,
        timeout: 30000,
      }
    );

    res.status(201).json({
      success: true,
      message: "Expense recorded successfully",
      data: {
        ...expense,
        amount: Number(expense.amount),
        amountPaid: Number(expense.amountPaid || 0),
        amountDue: Number(expense.amountDue || 0),
        quantity: expense.quantity ? Number(expense.quantity) : null,
        unitPrice: expense.unitPrice ? Number(expense.unitPrice) : null,
      },
    });
  } catch (error) {
    if (error.code === "UNSUPPORTED_UNIT" || error.code === "INVALID_BAG_WEIGHT") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * Retrieves all expenses belonging to the authenticated user with filtering.
 */
const getExpenses = async (req, res, next) => {
  try {
    const { houseId, flockId, supplierId, feedTypeId, category, paymentStatus, startDate, endDate } = req.query;

    const where = {
      userId: req.user.id,
    };

    if (houseId) {
      where.houseId = Number(houseId);
    }

    if (flockId) {
      where.flockId = Number(flockId);
    }

    if (supplierId) {
      where.supplierId = Number(supplierId);
    }

    if (feedTypeId) {
      where.feedTypeId = Number(feedTypeId);
    }

    if (category) {
      where.category = String(category);
    }

    if (paymentStatus) {
      if (paymentStatus === "UNSETTLED" || paymentStatus === "OUTSTANDING") {
        where.paymentStatus = { in: ["PARTIALLY_PAID", "UNPAID"] };
      } else {
        where.paymentStatus = String(paymentStatus);
      }
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
        flock: {
          select: { id: true, name: true, purpose: true },
        },
        breed: {
          select: { id: true, name: true },
        },
        supplier: {
          select: { id: true, name: true, phone: true, category: true },
        },
        feedType: {
          select: { id: true, name: true, unit: true, bagWeightKg: true },
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
        amountPaid: Number(e.amountPaid || 0),
        amountDue: Number(e.amountDue || 0),
        quantity: e.quantity ? Number(e.quantity) : null,
        unitPrice: e.unitPrice ? Number(e.unitPrice) : null,
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
        flock: {
          select: { id: true, name: true, purpose: true },
        },
        breed: {
          select: { id: true, name: true },
        },
        supplier: {
          select: { id: true, name: true, phone: true, category: true },
        },
        feedType: {
          select: { id: true, name: true, unit: true, bagWeightKg: true },
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
        amountPaid: Number(expense.amountPaid || 0),
        amountDue: Number(expense.amountDue || 0),
        quantity: expense.quantity ? Number(expense.quantity) : null,
        unitPrice: expense.unitPrice ? Number(expense.unitPrice) : null,
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
    const {
      houseId,
      flockId,
      breedId,
      supplierId,
      feedTypeId,
      category,
      amount,
      date,
      description,
      quantity,
      unit,
      unitPrice,
      amountPaid,
      paymentStatus,
    } = req.body;

    const existing = await prisma.expense.findFirst({
      where: {
        id: Number(id),
        userId: req.user.id,
      },
      include: {
        inventoryMovements: true,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Expense record not found",
      });
    }

    const targetHouseId = houseId !== undefined ? (houseId ? Number(houseId) : null) : existing.houseId;
    const targetFlockId = flockId !== undefined ? (flockId ? Number(flockId) : null) : existing.flockId;
    const check = await validateOwnership(
      req.user.id,
      targetHouseId,
      breedId !== undefined ? breedId : existing.breedId,
      null,
      supplierId !== undefined ? supplierId : existing.supplierId,
      feedTypeId !== undefined ? feedTypeId : existing.feedTypeId,
      targetFlockId
    );
    if (!check.valid) {
      return res.status(check.status).json({
        success: false,
        message: check.error,
      });
    }

    const effectiveAmount = amount !== undefined ? Number(amount) : Number(existing.amount);
    const wasFullyPaid = Number(existing.amountDue || 0) === 0 || Number(existing.amountPaid || 0) >= Number(existing.amount);
    const effectivePaid = amountPaid !== undefined ? Math.min(Number(amountPaid), effectiveAmount) : wasFullyPaid ? effectiveAmount : Math.min(Number(existing.amountPaid || 0), effectiveAmount);
    const payState = computePaymentState(effectiveAmount, effectivePaid, paymentStatus);

    const updated = await prisma.$transaction(
      async (tx) => {
        // 1. Revert previous purchase movement if existed
        const prevPurchase = existing.inventoryMovements.find((m) => m.type === "PURCHASE");
      if (prevPurchase) {
        const prevFeed = await tx.feedType.findUnique({ where: { id: prevPurchase.feedTypeId } });
        if (prevFeed) {
          await tx.feedType.update({
            where: { id: prevFeed.id },
            data: {
              currentStock: Number(prevFeed.currentStock) - Number(prevPurchase.quantity),
            },
          });
        }
        await tx.inventoryMovement.delete({ where: { id: prevPurchase.id } });
      }

      // 2. Resolve feedType
      const resolvedFeedTypeId =
        feedTypeId !== undefined ? (feedTypeId ? Number(feedTypeId) : null) : existing.feedTypeId;
      let feedType = null;
      if (resolvedFeedTypeId) {
        feedType = await tx.feedType.findUnique({ where: { id: resolvedFeedTypeId } });
      }

      const finalQty =
        quantity !== undefined ? (quantity !== null && quantity !== "" ? Number(quantity) : null) : existing.quantity;
      const finalUnit = unit !== undefined ? (unit ? unit.trim() : null) : existing.unit;

      const exp = await tx.expense.update({
        where: {
          id: Number(id),
        },
        data: {
          houseId: houseId !== undefined ? (houseId ? Number(houseId) : null) : existing.houseId,
          flockId: flockId !== undefined ? (flockId ? Number(flockId) : null) : existing.flockId,
          breedId: breedId !== undefined ? (breedId ? Number(breedId) : null) : existing.breedId,
          supplierId: supplierId !== undefined ? (supplierId ? Number(supplierId) : null) : existing.supplierId,
          feedTypeId: resolvedFeedTypeId,
          category: category !== undefined ? category.trim() : existing.category,
          amount: payState.amount,
          date: date ? new Date(date) : existing.date,
          description: description !== undefined ? (description ? description.trim() : null) : existing.description,
          quantity: finalQty,
          unit: finalUnit || (feedType ? feedType.unit : null),
          unitPrice: unitPrice !== undefined ? (unitPrice !== null && unitPrice !== "" ? Number(unitPrice) : null) : existing.unitPrice,
          amountPaid: payState.amountPaid,
          amountDue: payState.amountDue,
          paymentStatus: payState.paymentStatus,
        },
        include: {
          house: {
            select: { id: true, name: true },
          },
          flock: {
            select: { id: true, name: true, purpose: true },
          },
          breed: {
            select: { id: true, name: true },
          },
          supplier: {
            select: { id: true, name: true, phone: true, category: true },
          },
          feedType: {
            select: { id: true, name: true, unit: true, bagWeightKg: true },
          },
        },
      });

      // 3. Apply new purchase movement if feedType & quantity > 0
      if (feedType && finalQty && Number(finalQty) > 0) {
        const freshFeed = await tx.feedType.findUnique({ where: { id: feedType.id } });
        const purchaseQty = convertToFeedUnit(Number(finalQty), finalUnit, freshFeed);
        const currentStock = Number(freshFeed.currentStock);
        const newStock = currentStock + purchaseQty;
        const effectiveUnitCost =
          purchaseQty > 0 ? Number((payState.amount / purchaseQty).toFixed(2)) : Number(freshFeed.unitCost);

        await tx.feedType.update({
          where: { id: freshFeed.id },
          data: {
            currentStock: newStock,
            unitCost: effectiveUnitCost > 0 ? effectiveUnitCost : freshFeed.unitCost,
          },
        });

        await tx.inventoryMovement.create({
          data: {
            userId: req.user.id,
            feedTypeId: freshFeed.id,
            houseId: exp.houseId,
            expenseId: exp.id,
            type: "PURCHASE",
            quantity: purchaseQty,
            unit: freshFeed.unit,
            unitCost: effectiveUnitCost,
            totalCost: payState.amount,
            balanceAfter: newStock,
            date: exp.date,
            reason: exp.supplier ? `Feed purchase from ${exp.supplier.name}` : "Feed purchase",
          },
        });
      }

        return exp;
      },
      {
        maxWait: 15000,
        timeout: 30000,
      }
    );

    res.json({
      success: true,
      message: "Expense updated successfully",
      data: {
        ...updated,
        amount: Number(updated.amount),
        amountPaid: Number(updated.amountPaid || 0),
        amountDue: Number(updated.amountDue || 0),
        quantity: updated.quantity ? Number(updated.quantity) : null,
        unitPrice: updated.unitPrice ? Number(updated.unitPrice) : null,
      },
    });
  } catch (error) {
    if (error.code === "UNSUPPORTED_UNIT" || error.code === "INVALID_BAG_WEIGHT") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * Deletes an existing expense record, verifying ownership and restoring inventory.
 */
const deleteExpense = async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.$transaction(
      async (tx) => {
        const existing = await tx.expense.findFirst({
          where: {
            id: Number(id),
            userId: req.user.id,
          },
          include: {
            inventoryMovements: true,
          },
        });

      if (!existing) {
        const error = new Error("Expense record not found");
        error.code = "NOT_FOUND";
        throw error;
      }

      // Revert any purchase movements
      const purchaseMovements = existing.inventoryMovements.filter(
        (m) => m.type === "PURCHASE"
      );

      for (const mov of purchaseMovements) {
        const feed = await tx.feedType.findUnique({
          where: { id: mov.feedTypeId },
        });
        if (feed) {
          await tx.feedType.update({
            where: { id: feed.id },
            data: {
              currentStock: Number(feed.currentStock) - Number(mov.quantity),
            },
          });
        }
        await tx.inventoryMovement.delete({
          where: { id: mov.id },
        });
      }

        await tx.expense.delete({
          where: {
            id: Number(id),
          },
        });
      },
      {
        maxWait: 15000,
        timeout: 30000,
      }
    );

    res.json({
      success: true,
      message: "Expense record deleted successfully",
    });
  } catch (error) {
    if (error.code === "NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
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
    const {
      houseId,
      flockId,
      breedId,
      customerId,
      category,
      amount,
      date,
      description,
      quantity,
      unit,
      unitPrice,
      amountPaid,
      paymentStatus,
    } = req.body;

    const check = await validateOwnership(req.user.id, houseId, breedId, customerId, null, null, flockId);
    if (!check.valid) {
      return res.status(check.status).json({
        success: false,
        message: check.error,
      });
    }

    // Auto-derive total if quantity and unitPrice provided without explicit amount
    let finalAmount = amount;
    if ((finalAmount === undefined || finalAmount === null) && quantity && unitPrice) {
      finalAmount = Number((Number(quantity) * Number(unitPrice)).toFixed(2));
    }

    const payState = computePaymentState(finalAmount, amountPaid, paymentStatus);

    const income = await prisma.income.create({
      data: {
        userId: req.user.id,
        houseId: houseId ? Number(houseId) : null,
        flockId: flockId ? Number(flockId) : null,
        breedId: breedId ? Number(breedId) : null,
        customerId: customerId ? Number(customerId) : null,
        category: category.trim(),
        amount: payState.amount,
        date: new Date(date),
        description: description ? description.trim() : null,
        quantity: quantity !== undefined && quantity !== null && quantity !== "" ? Number(quantity) : null,
        unit: unit ? unit.trim() : null,
        unitPrice: unitPrice !== undefined && unitPrice !== null && unitPrice !== "" ? Number(unitPrice) : null,
        amountPaid: payState.amountPaid,
        amountDue: payState.amountDue,
        paymentStatus: payState.paymentStatus,
      },
      include: {
        house: {
          select: { id: true, name: true },
        },
        flock: {
          select: { id: true, name: true, purpose: true },
        },
        breed: {
          select: { id: true, name: true },
        },
        customer: {
          select: { id: true, name: true, phone: true, email: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: "Income recorded successfully",
      data: {
        ...income,
        amount: Number(income.amount),
        amountPaid: Number(income.amountPaid || 0),
        amountDue: Number(income.amountDue || 0),
        quantity: income.quantity ? Number(income.quantity) : null,
        unitPrice: income.unitPrice ? Number(income.unitPrice) : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves all income records belonging to the authenticated user with filtering.
 */
const getIncome = async (req, res, next) => {
  try {
    const { houseId, flockId, customerId, category, paymentStatus, startDate, endDate } = req.query;

    const where = {
      userId: req.user.id,
    };

    if (houseId) {
      where.houseId = Number(houseId);
    }

    if (flockId) {
      where.flockId = Number(flockId);
    }

    if (customerId) {
      where.customerId = Number(customerId);
    }

    if (category) {
      where.category = String(category);
    }

    if (paymentStatus) {
      if (paymentStatus === "UNSETTLED" || paymentStatus === "OUTSTANDING") {
        where.paymentStatus = { in: ["PARTIALLY_PAID", "UNPAID"] };
      } else {
        where.paymentStatus = String(paymentStatus);
      }
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
        flock: {
          select: { id: true, name: true, purpose: true },
        },
        breed: {
          select: { id: true, name: true },
        },
        customer: {
          select: { id: true, name: true, phone: true, email: true },
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
        amountPaid: Number(i.amountPaid || 0),
        amountDue: Number(i.amountDue || 0),
        quantity: i.quantity ? Number(i.quantity) : null,
        unitPrice: i.unitPrice ? Number(i.unitPrice) : null,
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
        flock: {
          select: { id: true, name: true, purpose: true },
        },
        breed: {
          select: { id: true, name: true },
        },
        customer: {
          select: { id: true, name: true, phone: true, email: true },
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
        amountPaid: Number(income.amountPaid || 0),
        amountDue: Number(income.amountDue || 0),
        quantity: income.quantity ? Number(income.quantity) : null,
        unitPrice: income.unitPrice ? Number(income.unitPrice) : null,
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
    const {
      houseId,
      flockId,
      breedId,
      customerId,
      category,
      amount,
      date,
      description,
      quantity,
      unit,
      unitPrice,
      amountPaid,
      paymentStatus,
    } = req.body;

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

    const targetHouseId = houseId !== undefined ? (houseId ? Number(houseId) : null) : existing.houseId;
    const targetFlockId = flockId !== undefined ? (flockId ? Number(flockId) : null) : existing.flockId;
    const check = await validateOwnership(
      req.user.id,
      targetHouseId,
      breedId !== undefined ? breedId : existing.breedId,
      customerId !== undefined ? customerId : existing.customerId,
      null,
      null,
      targetFlockId
    );
    if (!check.valid) {
      return res.status(check.status).json({
        success: false,
        message: check.error,
      });
    }

    const effectiveAmount = amount !== undefined ? Number(amount) : Number(existing.amount);
    const wasFullyPaid = Number(existing.amountDue || 0) === 0 || Number(existing.amountPaid || 0) >= Number(existing.amount);
    const effectivePaid = amountPaid !== undefined ? Math.min(Number(amountPaid), effectiveAmount) : wasFullyPaid ? effectiveAmount : Math.min(Number(existing.amountPaid || 0), effectiveAmount);
    const payState = computePaymentState(effectiveAmount, effectivePaid, paymentStatus);

    const updated = await prisma.income.update({
      where: {
        id: Number(id),
      },
      data: {
        houseId: houseId !== undefined ? (houseId ? Number(houseId) : null) : existing.houseId,
        flockId: flockId !== undefined ? (flockId ? Number(flockId) : null) : existing.flockId,
        breedId: breedId !== undefined ? (breedId ? Number(breedId) : null) : existing.breedId,
        customerId: customerId !== undefined ? (customerId ? Number(customerId) : null) : existing.customerId,
        category: category !== undefined ? category.trim() : existing.category,
        amount: payState.amount,
        date: date ? new Date(date) : existing.date,
        description: description !== undefined ? (description ? description.trim() : null) : existing.description,
        quantity: quantity !== undefined ? (quantity !== null && quantity !== "" ? Number(quantity) : null) : existing.quantity,
        unit: unit !== undefined ? (unit ? unit.trim() : null) : existing.unit,
        unitPrice: unitPrice !== undefined ? (unitPrice !== null && unitPrice !== "" ? Number(unitPrice) : null) : existing.unitPrice,
        amountPaid: payState.amountPaid,
        amountDue: payState.amountDue,
        paymentStatus: payState.paymentStatus,
      },
      include: {
        house: {
          select: { id: true, name: true },
        },
        flock: {
          select: { id: true, name: true, purpose: true },
        },
        breed: {
          select: { id: true, name: true },
        },
        customer: {
          select: { id: true, name: true, phone: true, email: true },
        },
      },
    });

    res.json({
      success: true,
      message: "Income updated successfully",
      data: {
        ...updated,
        amount: Number(updated.amount),
        amountPaid: Number(updated.amountPaid || 0),
        amountDue: Number(updated.amountDue || 0),
        quantity: updated.quantity ? Number(updated.quantity) : null,
        unitPrice: updated.unitPrice ? Number(updated.unitPrice) : null,
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
 * Retrieves aggregate financial KPI metrics for the farm / user,
 * including cash flow, customer receivables, and supplier payables.
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
    const diffToMonday = (dayOfWeek + 6) % 7;
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
        select: { amount: true, amountDue: true, category: true },
      }),
      prisma.income.findMany({
        where: whereBase,
        select: { amount: true, amountDue: true, category: true },
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

    // Phase 2 Receivables & Payables
    const totalCustomerOutstanding = allIncome.reduce((sum, item) => sum + Number(item.amountDue || 0), 0);
    const totalSupplierOutstanding = allExpenses.reduce((sum, item) => sum + Number(item.amountDue || 0), 0);

    // Category specifics
    const eggSalesTotal = allIncome
      .filter((i) => i.category.toLowerCase().includes("egg"))
      .reduce((sum, i) => sum + Number(i.amount), 0);

    const birdSalesTotal = allIncome
      .filter((i) => i.category.toLowerCase().includes("bird"))
      .reduce((sum, i) => sum + Number(i.amount), 0);

    const feedExpenseTotal = allExpenses
      .filter((e) => e.category.toLowerCase().includes("feed"))
      .reduce((sum, e) => sum + Number(e.amount), 0);

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
        totalCustomerOutstanding,
        totalSupplierOutstanding,
        eggSalesTotal,
        birdSalesTotal,
        feedExpenseTotal,
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
 * Supports filtering by type, category, date range, houseId, customerId, supplierId, paymentStatus, and search.
 */
const getFinancialTransactions = async (req, res, next) => {
  try {
    const {
      type, // 'all' | 'expense' | 'income'
      category,
      houseId,
      flockId,
      customerId,
      supplierId,
      paymentStatus,
      startDate,
      endDate,
      search,
      sortOrder = "desc",
    } = req.query;

    const userId = req.user.id;

    const baseWhere = {
      userId,
      ...(houseId ? { houseId: Number(houseId) } : {}),
      ...(flockId ? { flockId: Number(flockId) } : {}),
      ...(category ? { category: String(category) } : {}),
      ...(paymentStatus
        ? paymentStatus === "UNSETTLED" || paymentStatus === "OUTSTANDING"
          ? { paymentStatus: { in: ["PARTIALLY_PAID", "UNPAID"] } }
          : { paymentStatus: String(paymentStatus) }
        : {}),
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
      const expWhere = {
        ...baseWhere,
        ...(supplierId ? { supplierId: Number(supplierId) } : {}),
      };

      expenses = await prisma.expense.findMany({
        where: expWhere,
        include: {
          house: { select: { id: true, name: true } },
          flock: { select: { id: true, name: true, purpose: true } },
          breed: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true, phone: true } },
          feedType: { select: { id: true, name: true, unit: true } },
        },
      });
    }

    if (!type || type === "all" || type === "income") {
      const incWhere = {
        ...baseWhere,
        ...(customerId ? { customerId: Number(customerId) } : {}),
      };

      income = await prisma.income.findMany({
        where: incWhere,
        include: {
          house: { select: { id: true, name: true } },
          flock: { select: { id: true, name: true, purpose: true } },
          breed: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true, phone: true } },
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
        flockId: e.flockId,
        flock: e.flock,
        breedId: e.breedId,
        breed: e.breed,
        supplierId: e.supplierId,
        supplier: e.supplier,
        feedTypeId: e.feedTypeId,
        feedType: e.feedType,
        quantity: e.quantity ? Number(e.quantity) : null,
        unit: e.unit,
        unitPrice: e.unitPrice ? Number(e.unitPrice) : null,
        amountPaid: Number(e.amountPaid || 0),
        amountDue: Number(e.amountDue || 0),
        paymentStatus: e.paymentStatus || "PAID",
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
        flockId: i.flockId,
        flock: i.flock,
        breedId: i.breedId,
        breed: i.breed,
        customerId: i.customerId,
        customer: i.customer,
        quantity: i.quantity ? Number(i.quantity) : null,
        unit: i.unit,
        unitPrice: i.unitPrice ? Number(i.unitPrice) : null,
        amountPaid: Number(i.amountPaid || 0),
        amountDue: Number(i.amountDue || 0),
        paymentStatus: i.paymentStatus || "PAID",
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
        const custName = (t.customer?.name || "").toLowerCase();
        const suppName = (t.supplier?.name || "").toLowerCase();
        return (
          cat.includes(q) ||
          desc.includes(q) ||
          houseName.includes(q) ||
          custName.includes(q) ||
          suppName.includes(q)
        );
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
 * Retrieves breakdown reports with date range presets and business summaries:
 * - Category breakdowns for expenses and income
 * - Monthly trends
 * - Detailed Egg Sales & Bird Sales summaries
 * - Feed purchase cost summary
 * - Customer Receivables summary
 * - Supplier Payables summary
 */
const getFinancialReports = async (req, res, next) => {
  try {
    const { houseId, dateRange, startDate: customStart, endDate: customEnd } = req.query;
    const userId = req.user.id;

    const whereBase = {
      userId,
      ...(houseId ? { houseId: Number(houseId) } : {}),
    };

    // Date Range calculation
    let dateFilter = null;
    const now = new Date();

    if (dateRange === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      dateFilter = { gte: start, lte: end };
    } else if (dateRange === "week") {
      const dayOfWeek = now.getDay();
      const diffToMonday = (dayOfWeek + 6) % 7;
      const start = new Date(now);
      start.setDate(now.getDate() - diffToMonday);
      start.setHours(0, 0, 0, 0);
      dateFilter = { gte: start };
    } else if (dateRange === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { gte: start };
    } else if (dateRange === "last_month") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      dateFilter = { gte: start, lte: end };
    } else if (dateRange === "year") {
      const start = new Date(now.getFullYear(), 0, 1);
      dateFilter = { gte: start };
    } else if (customStart || customEnd) {
      dateFilter = {};
      if (customStart) dateFilter.gte = new Date(customStart);
      if (customEnd) dateFilter.lte = new Date(customEnd);
    }

    if (dateFilter) {
      whereBase.date = dateFilter;
    }

    const [expenses, income, customersWithDebt, suppliersOwed] = await Promise.all([
      prisma.expense.findMany({
        where: whereBase,
        include: {
          supplier: { select: { id: true, name: true, phone: true } },
          house: { select: { id: true, name: true } },
        },
        orderBy: { date: "asc" },
      }),
      prisma.income.findMany({
        where: whereBase,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          house: { select: { id: true, name: true } },
        },
        orderBy: { date: "asc" },
      }),
      // Outstanding customer debts (regardless of date filter or within scope)
      prisma.income.findMany({
        where: {
          userId,
          amountDue: { gt: 0 },
        },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
        },
      }),
      // Outstanding supplier payables
      prisma.expense.findMany({
        where: {
          userId,
          amountDue: { gt: 0 },
        },
        include: {
          supplier: { select: { id: true, name: true, phone: true } },
        },
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
    const expenseBreakdown = Object.values(expenseCategoryMap)
      .map((cat) => ({
        ...cat,
        percentage: totalExpenses > 0 ? Number(((cat.total / totalExpenses) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.total - a.total);

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
    const incomeBreakdown = Object.values(incomeCategoryMap)
      .map((cat) => ({
        ...cat,
        percentage: totalIncome > 0 ? Number(((cat.total / totalIncome) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.total - a.total);

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

    // 4. Product Specific Summaries (Egg Sales & Bird Sales)
    const eggSales = income.filter((i) => i.category.toLowerCase().includes("egg"));
    const eggTotalRevenue = eggSales.reduce((sum, i) => sum + Number(i.amount), 0);
    const eggTotalQuantity = eggSales.reduce((sum, i) => sum + Number(i.quantity || 0), 0);
    const eggSalesSummary = {
      totalRevenue: eggTotalRevenue,
      totalQuantity: eggTotalQuantity,
      count: eggSales.length,
      averageRevenue: eggSales.length > 0 ? Number((eggTotalRevenue / eggSales.length).toFixed(2)) : 0,
    };

    const birdSales = income.filter((i) => i.category.toLowerCase().includes("bird"));
    const birdTotalRevenue = birdSales.reduce((sum, i) => sum + Number(i.amount), 0);
    const birdTotalQuantity = birdSales.reduce((sum, i) => sum + Number(i.quantity || 0), 0);
    const birdSalesSummary = {
      totalRevenue: birdTotalRevenue,
      totalQuantity: birdTotalQuantity,
      count: birdSales.length,
      averageRevenue: birdSales.length > 0 ? Number((birdTotalRevenue / birdSales.length).toFixed(2)) : 0,
    };

    // 5. Feed Purchase Summary
    const feedPurchases = expenses.filter((e) => e.category.toLowerCase().includes("feed"));
    const feedTotalSpent = feedPurchases.reduce((sum, e) => sum + Number(e.amount), 0);
    const feedTotalQuantity = feedPurchases.reduce((sum, e) => sum + Number(e.quantity || 0), 0);
    const feedCostSummary = {
      totalSpent: feedTotalSpent,
      totalQuantity: feedTotalQuantity,
      count: feedPurchases.length,
      averageSpent: feedPurchases.length > 0 ? Number((feedTotalSpent / feedPurchases.length).toFixed(2)) : 0,
    };

    // 6. Customer Debts / Receivables
    const totalCustomerOutstanding = customersWithDebt.reduce((sum, i) => sum + Number(i.amountDue || 0), 0);
    const debtorMap = {};
    for (const item of customersWithDebt) {
      const cId = item.customer?.id || `unassigned-${item.id}`;
      const cName = item.customer?.name || "Unassigned Customer";
      const cPhone = item.customer?.phone || "";
      if (!debtorMap[cId]) {
        debtorMap[cId] = { id: item.customer?.id || null, name: cName, phone: cPhone, totalOutstanding: 0 };
      }
      debtorMap[cId].totalOutstanding += Number(item.amountDue || 0);
    }
    const topDebtors = Object.values(debtorMap).sort((a, b) => b.totalOutstanding - a.totalOutstanding);

    // 7. Supplier Payables
    const totalSupplierOutstanding = suppliersOwed.reduce((sum, e) => sum + Number(e.amountDue || 0), 0);
    const payableMap = {};
    for (const item of suppliersOwed) {
      const sId = item.supplier?.id || `unassigned-${item.id}`;
      const sName = item.supplier?.name || "Unassigned Supplier";
      const sPhone = item.supplier?.phone || "";
      if (!payableMap[sId]) {
        payableMap[sId] = { id: item.supplier?.id || null, name: sName, phone: sPhone, totalOutstanding: 0 };
      }
      payableMap[sId].totalOutstanding += Number(item.amountDue || 0);
    }
    const topSuppliersOwed = Object.values(payableMap).sort((a, b) => b.totalOutstanding - a.totalOutstanding);

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
        eggSalesSummary,
        birdSalesSummary,
        feedCostSummary,
        customerDebtSummary: {
          totalOutstanding: totalCustomerOutstanding,
          topDebtors,
        },
        supplierPayablesSummary: {
          totalOutstanding: totalSupplierOutstanding,
          topSuppliersOwed,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  validateOwnership,
  computePaymentState,
  convertToFeedUnit,
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
