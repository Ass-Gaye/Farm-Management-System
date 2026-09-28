const prisma = require("../lib/prisma");
const { runSerializable } = require("../lib/transaction");
const { computePaymentState } = require("../services/finance.service");
const {
  EGG_UNIT,
  MANUAL_EGG_MOVEMENT_TYPES,
  ensureEggInventory,
  applyEggStockChange,
} = require("../services/egg-inventory.service");
const { assertFlockOperational } = require("../services/flock-lifecycle.service");

const EGG_SALE_CATEGORY = "Egg sales";

const saleInclude = {
  house: { select: { id: true, name: true } },
  flock: { select: { id: true, name: true, batchNumber: true } },
  customer: { select: { id: true, name: true, phone: true } },
  income: {
    select: {
      id: true,
      amount: true,
      category: true,
      customerId: true,
      unitPrice: true,
      amountPaid: true,
      amountDue: true,
      paymentStatus: true,
      customer: { select: { id: true, name: true, phone: true } },
    },
  },
};

/**
 * Returns the farmer's current egg stock (pieces) plus ledger totals.
 * Never creates rows on read: new farmers see zero stock.
 */
const getEggInventory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const inventory = await prisma.eggInventory.findUnique({
      where: { userId },
    });

    const totals = await prisma.eggMovement.groupBy({
      by: ["type"],
      where: { userId },
      _sum: { quantity: true },
    });

    const byType = {};
    for (const row of totals) {
      byType[row.type] = Number(row._sum.quantity || 0);
    }

    res.json({
      success: true,
      data: {
        currentStock: inventory ? Number(inventory.currentStock) : 0,
        unit: EGG_UNIT,
        totalProduced: byType.PRODUCTION || 0,
        totalSold: Math.abs(byType.SALE || 0),
        totalWasted: Math.abs(byType.WASTAGE || 0),
        totalAdjusted: byType.ADJUSTMENT || 0,
        totalReturned: byType.RETURN || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lists egg movements (audit ledger), newest first.
 */
const getEggMovements = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { type, houseId, startDate, endDate, limit = 100, page = 1 } = req.query;

    const where = { userId };
    if (type) where.type = String(type).toUpperCase();
    if (houseId) where.houseId = Number(houseId);
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const take = Math.min(Number(limit) || 100, 200);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const [movements, total] = await Promise.all([
      prisma.eggMovement.findMany({
        where,
        include: {
          house: { select: { id: true, name: true } },
          flock: { select: { id: true, name: true } },
        },
        orderBy: { date: "desc" },
        take,
        skip,
      }),
      prisma.eggMovement.count({ where }),
    ]);

    res.json({ success: true, data: movements, pagination: { total, page: Number(page) || 1, limit: take } });
  } catch (error) {
    next(error);
  }
};

/**
 * Manual egg stock adjustment (breakage, spoilage, counting correction,
 * found stock, returns). Never creates Income.
 */
const recordEggAdjustment = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      type = "ADJUSTMENT",
      quantity,
      reason,
      date = new Date(),
      houseId,
    } = req.body;

    const normalizedType = String(type || "ADJUSTMENT").trim().toUpperCase();
    if (!MANUAL_EGG_MOVEMENT_TYPES.includes(normalizedType)) {
      return res.status(400).json({
        success: false,
        message: "Manual egg movements must be ADJUSTMENT, WASTAGE, or RETURN. Production and sales are recorded automatically.",
      });
    }

    const signedQty = Number(quantity);
    if (!Number.isInteger(signedQty) || signedQty === 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a non-zero whole number of eggs (negative for wastage/breakage, positive for found stock or returns).",
      });
    }

    let verifiedHouseId = null;
    if (houseId) {
      const house = await prisma.poultryHouse.findFirst({
        where: { id: Number(houseId), userId },
      });
      if (!house) {
        return res.status(404).json({
          success: false,
          message: "Poultry house not found or does not belong to your farm",
        });
      }
      verifiedHouseId = house.id;
    }

    let result;
    try {
      result = await runSerializable(async (tx) =>
        applyEggStockChange(tx, {
          userId,
          delta: signedQty,
          type: normalizedType,
          houseId: verifiedHouseId,
          date: date ? new Date(date) : new Date(),
          reason: reason?.trim() || `Manual egg ${normalizedType.toLowerCase()}`,
        })
      );
    } catch (error) {
      if (error.code === "NEGATIVE_EGG_STOCK") {
        return res.status(400).json({ success: false, message: error.message });
      }
      throw error;
    }

    res.status(201).json({
      success: true,
      message: "Egg stock adjustment recorded successfully",
      data: {
        ...result.movement,
        stockBefore: result.stockBefore,
        stockAfter: result.stockAfter,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Creates an egg sale: verifies ownership + stock, decrements inventory,
 * creates/link Income ("Egg sales"), appends the SALE movement — atomically.
 * Quantity is a count of eggs (pieces); unitPrice is GMD per egg.
 */
const createEggSale = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      houseId,
      flockId,
      customerId,
      quantity,
      unitPrice,
      amount,
      amountPaid,
      paymentStatus,
      date,
      notes,
      incomeId,
    } = req.body;

    const numQuantity = Number(quantity);
    if (!Number.isInteger(numQuantity) || numQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a whole number of eggs greater than 0",
      });
    }

    let sale;
    let stockAfter;
    try {
      const result = await runSerializable(async (tx) => {
        let verifiedHouseId = null;
        if (houseId) {
          const house = await tx.poultryHouse.findFirst({
            where: { id: Number(houseId), userId },
          });
          if (!house) {
            const error = new Error("Poultry house not found or does not belong to your farm");
            error.code = "HOUSE_NOT_FOUND";
            throw error;
          }
          verifiedHouseId = house.id;
        }

        let ownedFlock = null;
        if (flockId) {
          ownedFlock = await tx.flock.findFirst({
            where: { id: Number(flockId), userId },
          });
          if (!ownedFlock) {
            const error = new Error("Flock not found or does not belong to your farm");
            error.code = "FLOCK_NOT_FOUND";
            throw error;
          }
          if (verifiedHouseId && ownedFlock.houseId !== verifiedHouseId) {
            const error = new Error("Flock does not belong to the selected poultry house");
            error.code = "FLOCK_HOUSE_MISMATCH";
            throw error;
          }
          // Phase 4.4 — closed flocks reject new operational records.
          assertFlockOperational(ownedFlock);
          verifiedHouseId = ownedFlock.houseId;
        }

        if (customerId) {
          const customer = await tx.customer.findFirst({
            where: { id: Number(customerId), userId },
          });
          if (!customer) {
            const error = new Error("Customer not found or does not belong to your farm");
            error.code = "CUSTOMER_NOT_FOUND";
            throw error;
          }
        }

        if (incomeId) {
          const income = await tx.income.findFirst({
            where: { id: Number(incomeId), userId },
          });
          if (!income) {
            const error = new Error("Income record not found or does not belong to your farm");
            error.code = "INCOME_NOT_FOUND";
            throw error;
          }
        }

        let resolvedIncomeId = incomeId ? Number(incomeId) : null;

        // Sale amount: explicit amount wins, otherwise quantity x price/egg.
        let finalAmount =
          amount !== undefined && amount !== null && amount !== "" ? Number(amount) : null;
        if (finalAmount === null && unitPrice !== undefined && unitPrice !== null && unitPrice !== "") {
          finalAmount = Number((numQuantity * Number(unitPrice)).toFixed(2));
        }

        if (!resolvedIncomeId && finalAmount !== null && finalAmount > 0) {
          const payState = computePaymentState(finalAmount, amountPaid, paymentStatus);
          const numUnitPrice =
            unitPrice !== undefined && unitPrice !== null && unitPrice !== ""
              ? Number(unitPrice)
              : Number((payState.amount / numQuantity).toFixed(2));

          const createdIncome = await tx.income.create({
            data: {
              userId,
              houseId: verifiedHouseId,
              flockId: ownedFlock ? ownedFlock.id : null,
              breedId: ownedFlock ? ownedFlock.breedId : null,
              customerId: customerId ? Number(customerId) : null,
              category: EGG_SALE_CATEGORY,
              amount: payState.amount,
              date: date ? new Date(date) : new Date(),
              description: notes ? notes.trim() : `Egg sale: ${numQuantity} eggs`,
              quantity: numQuantity,
              unit: "pieces",
              unitPrice: numUnitPrice,
              amountPaid: payState.amountPaid,
              amountDue: payState.amountDue,
              paymentStatus: payState.paymentStatus,
            },
          });
          resolvedIncomeId = createdIncome.id;
        }

        // Decrement stock first: throws NEGATIVE_EGG_STOCK before any
        // Income or sale row can persist, so stock and finance stay in sync.
        const inventory = await ensureEggInventory(tx, userId);
        const stockBefore = Number(inventory.currentStock);
        const newStock = stockBefore - numQuantity;
        if (newStock < 0) {
          const error = new Error(
            `Not enough eggs in stock. Available: ${stockBefore} eggs, required: ${numQuantity} eggs.`
          );
          error.code = "INSUFFICIENT_EGG_STOCK";
          throw error;
        }
        await tx.eggInventory.update({
          where: { userId },
          data: { currentStock: newStock },
        });

        const created = await tx.eggSale.create({
          data: {
            userId,
            houseId: verifiedHouseId,
            flockId: ownedFlock ? ownedFlock.id : null,
            customerId: customerId ? Number(customerId) : null,
            incomeId: resolvedIncomeId,
            quantity: numQuantity,
            unitPrice:
              unitPrice !== undefined && unitPrice !== null && unitPrice !== ""
                ? Number(unitPrice)
                : null,
            date: date ? new Date(date) : new Date(),
            notes: notes ? notes.trim() : null,
          },
          include: saleInclude,
        });

        await tx.eggMovement.create({
          data: {
            userId,
            houseId: verifiedHouseId,
            flockId: ownedFlock ? ownedFlock.id : null,
            eggSaleId: created.id,
            type: "SALE",
            quantity: -numQuantity,
            unit: EGG_UNIT,
            balanceAfter: newStock,
            date: date ? new Date(date) : new Date(),
            reason: `Egg sale of ${numQuantity} eggs`,
          },
        });

        return { created, stockAfter: newStock };
      });
      sale = result.created;
      stockAfter = result.stockAfter;
    } catch (error) {
      if (
        error.code === "HOUSE_NOT_FOUND" ||
        error.code === "FLOCK_NOT_FOUND" ||
        error.code === "CUSTOMER_NOT_FOUND" ||
        error.code === "INCOME_NOT_FOUND"
      ) {
        return res.status(404).json({ success: false, message: error.message });
      }
      if (error.code === "INSUFFICIENT_EGG_STOCK" || error.code === "FLOCK_HOUSE_MISMATCH" || error.code === "FLOCK_NOT_ACTIVE") {
        return res.status(400).json({ success: false, message: error.message });
      }
      if (error.code === "P2002") {
        return res.status(409).json({
          success: false,
          message: "This sale was already recorded. Please refresh instead of retrying.",
        });
      }
      throw error;
    }

    res.status(201).json({
      success: true,
      message: "Egg sale recorded successfully",
      data: { ...sale, stockAfter },
    });
  } catch (error) {
    next(error);
  }
};

const getEggSales = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { houseId, flockId, customerId, startDate, endDate } = req.query;

    const where = { userId };
    if (houseId) where.houseId = Number(houseId);
    if (flockId) where.flockId = Number(flockId);
    if (customerId) where.customerId = Number(customerId);
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const sales = await prisma.eggSale.findMany({
      where,
      include: saleInclude,
      orderBy: { date: "desc" },
    });

    res.json({ success: true, data: sales });
  } catch (error) {
    next(error);
  }
};

const getEggSaleById = async (req, res, next) => {
  try {
    const sale = await prisma.eggSale.findFirst({
      where: { id: Number(req.params.id), userId: req.user.id },
      include: saleInclude,
    });
    if (!sale) {
      return res.status(404).json({ success: false, message: "Egg sale not found" });
    }
    res.json({ success: true, data: sale });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates an egg sale: stock moves by the quantity difference only, the
 * linked Income is updated in place (never duplicated), atomically.
 */
const updateEggSale = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const saleId = Number(req.params.id);
    const {
      houseId,
      flockId,
      customerId,
      quantity,
      unitPrice,
      amount,
      amountPaid,
      paymentStatus,
      date,
      notes,
      incomeId,
    } = req.body;

    const existing = await prisma.eggSale.findFirst({
      where: { id: saleId, userId },
      include: { income: true },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Egg sale not found" });
    }

    const newQuantity =
      quantity !== undefined ? Number(quantity) : existing.quantity;
    if (quantity !== undefined && (!Number.isInteger(newQuantity) || newQuantity <= 0)) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a whole number of eggs greater than 0",
      });
    }

    let updated;
    let stockAfter;
    try {
      const result = await runSerializable(async (tx) => {
        const targetHouseId =
          houseId !== undefined ? (houseId ? Number(houseId) : null) : existing.houseId;
        const targetFlockId =
          flockId !== undefined ? (flockId ? Number(flockId) : null) : existing.flockId;

        if (targetHouseId) {
          const house = await tx.poultryHouse.findFirst({
            where: { id: targetHouseId, userId },
          });
          if (!house) {
            const error = new Error("Poultry house not found or does not belong to your farm");
            error.code = "HOUSE_NOT_FOUND";
            throw error;
          }
        }

        let ownedFlock = null;
        if (targetFlockId) {
          ownedFlock = await tx.flock.findFirst({
            where: { id: targetFlockId, userId },
          });
          if (!ownedFlock) {
            const error = new Error("Flock not found or does not belong to your farm");
            error.code = "FLOCK_NOT_FOUND";
            throw error;
          }
          const effectiveHouseId = targetHouseId || ownedFlock.houseId;
          if (targetHouseId && ownedFlock.houseId !== targetHouseId) {
            const error = new Error("Flock does not belong to the selected poultry house");
            error.code = "FLOCK_HOUSE_MISMATCH";
            throw error;
          }
          // Phase 4.4 — sales may not be moved onto a closed flock.
          if (targetFlockId !== existing.flockId) {
            assertFlockOperational(ownedFlock);
          }
        }

        if (customerId !== undefined && customerId) {
          const customer = await tx.customer.findFirst({
            where: { id: Number(customerId), userId },
          });
          if (!customer) {
            const error = new Error("Customer not found or does not belong to your farm");
            error.code = "CUSTOMER_NOT_FOUND";
            throw error;
          }
        }

        if (incomeId !== undefined && incomeId) {
          const income = await tx.income.findFirst({
            where: { id: Number(incomeId), userId },
          });
          if (!income) {
            const error = new Error("Income record not found or does not belong to your farm");
            error.code = "INCOME_NOT_FOUND";
            throw error;
          }
        }

        let resolvedIncomeId =
          incomeId !== undefined ? (incomeId ? Number(incomeId) : null) : existing.incomeId;

        // Adjust stock by the difference only: growth consumes stock,
        // shrinkage returns stock.
        const stockDiff = newQuantity - existing.quantity;
        const inventory = await ensureEggInventory(tx, userId);
        const stockBefore = Number(inventory.currentStock);
        const newStock = stockBefore - stockDiff;
        if (newStock < 0) {
          const error = new Error(
            `Not enough eggs in stock for this change. Available: ${stockBefore} eggs, additional required: ${stockDiff} eggs.`
          );
          error.code = "INSUFFICIENT_EGG_STOCK";
          throw error;
        }
        await tx.eggInventory.update({
          where: { userId },
          data: { currentStock: newStock },
        });

        if (resolvedIncomeId) {
          const linkedIncome = await tx.income.findFirst({
            where: { id: resolvedIncomeId, userId },
          });
          if (linkedIncome) {
            const effectiveQty = newQuantity;
            let effectiveUnitPrice =
              unitPrice !== undefined
                ? unitPrice !== null && unitPrice !== ""
                  ? Number(unitPrice)
                  : null
                : linkedIncome.unitPrice
                  ? Number(linkedIncome.unitPrice)
                  : null;

            let effectiveAmount =
              amount !== undefined && amount !== null && amount !== "" ? Number(amount) : null;
            if (effectiveAmount === null) {
              if (effectiveUnitPrice !== null) {
                effectiveAmount = Number((effectiveQty * effectiveUnitPrice).toFixed(2));
              } else if (newQuantity !== existing.quantity && existing.quantity > 0) {
                const unitRate = Number(linkedIncome.amount) / existing.quantity;
                effectiveAmount = Number((effectiveQty * unitRate).toFixed(2));
              } else {
                effectiveAmount = Number(linkedIncome.amount);
              }
            }

            const wasFullyPaid =
              Number(linkedIncome.amountDue || 0) === 0 ||
              Number(linkedIncome.amountPaid || 0) >= Number(linkedIncome.amount);
            const effectivePaid =
              amountPaid !== undefined && amountPaid !== null && amountPaid !== ""
                ? Math.min(Number(amountPaid), effectiveAmount)
                : wasFullyPaid
                  ? effectiveAmount
                  : Math.min(Number(linkedIncome.amountPaid || 0), effectiveAmount);

            const payState = computePaymentState(
              effectiveAmount,
              effectivePaid,
              paymentStatus || linkedIncome.paymentStatus
            );
            const targetCustomerId =
              customerId !== undefined
                ? customerId
                  ? Number(customerId)
                  : null
                : linkedIncome.customerId;

            await tx.income.update({
              where: { id: linkedIncome.id },
              data: {
                amount: payState.amount,
                quantity: effectiveQty,
                unitPrice: effectiveUnitPrice,
                amountPaid: payState.amountPaid,
                amountDue: payState.amountDue,
                paymentStatus: payState.paymentStatus,
                customerId: targetCustomerId,
                houseId: targetHouseId,
                flockId: targetFlockId,
                date: date ? new Date(date) : linkedIncome.date,
                description:
                  notes !== undefined
                    ? notes
                      ? notes.trim()
                      : null
                    : linkedIncome.description,
              },
            });
          }
        } else {
          let finalAmount =
            amount !== undefined && amount !== null && amount !== "" ? Number(amount) : null;
          if (finalAmount === null && unitPrice !== undefined && unitPrice !== null && unitPrice !== "") {
            finalAmount = Number((newQuantity * Number(unitPrice)).toFixed(2));
          }
          if (finalAmount !== null && finalAmount > 0) {
            const payState = computePaymentState(finalAmount, amountPaid, paymentStatus);
            const numUnitPrice =
              unitPrice !== undefined && unitPrice !== null && unitPrice !== ""
                ? Number(unitPrice)
                : Number((payState.amount / newQuantity).toFixed(2));
            const createdIncome = await tx.income.create({
              data: {
                userId,
                houseId: targetHouseId,
                flockId: targetFlockId,
                breedId: ownedFlock ? ownedFlock.breedId : existing.income?.breedId ?? null,
                customerId: customerId !== undefined ? (customerId ? Number(customerId) : null) : null,
                category: EGG_SALE_CATEGORY,
                amount: payState.amount,
                date: date ? new Date(date) : existing.date,
                description: notes ? notes.trim() : `Egg sale: ${newQuantity} eggs`,
                quantity: newQuantity,
                unit: "pieces",
                unitPrice: numUnitPrice,
                amountPaid: payState.amountPaid,
                amountDue: payState.amountDue,
                paymentStatus: payState.paymentStatus,
              },
            });
            resolvedIncomeId = createdIncome.id;
          }
        }

        const saved = await tx.eggSale.update({
          where: { id: saleId },
          data: {
            houseId: targetHouseId,
            flockId: targetFlockId,
            customerId:
              customerId !== undefined
                ? customerId
                  ? Number(customerId)
                  : null
                : existing.customerId,
            incomeId: resolvedIncomeId,
            quantity: newQuantity,
            unitPrice:
              unitPrice !== undefined
                ? unitPrice !== null && unitPrice !== ""
                  ? Number(unitPrice)
                  : null
                : existing.unitPrice,
            date: date ? new Date(date) : existing.date,
            notes: notes !== undefined ? (notes ? notes.trim() : null) : existing.notes,
          },
          include: saleInclude,
        });

        await tx.eggMovement.upsert({
          where: { eggSaleId: saleId },
          create: {
            userId,
            houseId: targetHouseId,
            flockId: targetFlockId,
            eggSaleId: saleId,
            type: "SALE",
            quantity: -newQuantity,
            unit: EGG_UNIT,
            balanceAfter: newStock,
            date: date ? new Date(date) : existing.date,
            reason: `Egg sale of ${newQuantity} eggs`,
          },
          update: {
            quantity: -newQuantity,
            balanceAfter: newStock,
            date: date ? new Date(date) : existing.date,
          },
        });

        return { saved, stockAfter: newStock };
      });
      updated = result.saved;
      stockAfter = result.stockAfter;
    } catch (error) {
      if (
        error.code === "HOUSE_NOT_FOUND" ||
        error.code === "FLOCK_NOT_FOUND" ||
        error.code === "CUSTOMER_NOT_FOUND" ||
        error.code === "INCOME_NOT_FOUND"
      ) {
        return res.status(404).json({ success: false, message: error.message });
      }
      if (error.code === "INSUFFICIENT_EGG_STOCK" || error.code === "FLOCK_HOUSE_MISMATCH" || error.code === "FLOCK_NOT_ACTIVE") {
        return res.status(400).json({ success: false, message: error.message });
      }
      if (error.code === "P2002") {
        return res.status(409).json({
          success: false,
          message: "This sale was already recorded. Please refresh instead of retrying.",
        });
      }
      throw error;
    }

    res.json({
      success: true,
      message: "Egg sale updated successfully",
      data: { ...updated, stockAfter },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deletes an egg sale: restores exactly its quantity to stock, removes the
 * SALE movement, and deletes the linked Income only when owned and
 * unreferenced by other sales (Phase 4.1 safety pattern).
 */
const deleteEggSale = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const saleId = Number(req.params.id);

    const existing = await prisma.eggSale.findFirst({
      where: { id: saleId, userId },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Egg sale not found" });
    }

    const { stockAfter } = await runSerializable(async (tx) => {
      const inventory = await ensureEggInventory(tx, userId);
      const newStock = Number(inventory.currentStock) + Number(existing.quantity);
      await tx.eggInventory.update({
        where: { userId },
        data: { currentStock: newStock },
      });

      await tx.eggMovement.deleteMany({
        where: { eggSaleId: saleId, userId },
      });

      if (existing.incomeId) {
        const otherSales = await tx.eggSale.count({
          where: { incomeId: existing.incomeId, id: { not: saleId } },
        });
        const otherDepops = await tx.depopulationEvent.count({
          where: { incomeId: existing.incomeId },
        });
        if (otherSales === 0 && otherDepops === 0) {
          const ownedIncome = await tx.income.findFirst({
            where: { id: existing.incomeId, userId },
          });
          if (ownedIncome) {
            await tx.income.delete({ where: { id: existing.incomeId } });
          }
        }
      }

      await tx.eggSale.delete({ where: { id: saleId } });

      return { stockAfter: newStock };
    });

    res.json({
      success: true,
      message: "Egg sale deleted successfully. Eggs restored to stock.",
      data: { stockAfter },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  EGG_SALE_CATEGORY,
  getEggInventory,
  getEggMovements,
  recordEggAdjustment,
  createEggSale,
  getEggSales,
  getEggSaleById,
  updateEggSale,
  deleteEggSale,
};
