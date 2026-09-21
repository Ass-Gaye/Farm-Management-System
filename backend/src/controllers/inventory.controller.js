const prisma = require("../lib/prisma");

/**
 * Returns an inventory dashboard overview:
 * - Total feed types count
 * - Low stock items count
 * - Total inventory valuation
 * - List of feed stocks with status
 * - Recent 10 inventory movements
 */
const getInventorySummary = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const feedTypes = await prisma.feedType.findMany({
      where: { userId, active: true },
      orderBy: { name: "asc" },
    });

    let totalValuation = 0;
    let lowStockCount = 0;

    const items = feedTypes.map((item) => {
      const stock = Number(item.currentStock);
      const minStock = Number(item.minimumStock);
      const uCost = Number(item.unitCost);
      const isLow = stock <= minStock;
      const value = stock * uCost;

      totalValuation += value;
      if (isLow) lowStockCount += 1;

      return {
        id: item.id,
        name: item.name,
        category: item.category,
        unit: item.unit,
        bagWeightKg: item.bagWeightKg,
        currentStock: stock,
        minimumStock: minStock,
        unitCost: uCost,
        valuation: value,
        isLowStock: isLow,
        active: item.active,
      };
    });

    const recentMovements = await prisma.inventoryMovement.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 10,
      include: {
        feedType: { select: { id: true, name: true, unit: true } },
        house: { select: { id: true, name: true } },
        dailyRecord: { select: { id: true, date: true, eggsCollected: true, mortality: true } },
        expense: {
          select: {
            id: true,
            amount: true,
            supplier: { select: { id: true, name: true } },
          },
        },
      },
    });

    res.json({
      success: true,
      data: {
        totalFeedTypes: feedTypes.length,
        lowStockCount,
        totalValuation: Math.round(totalValuation * 100) / 100,
        items,
        recentMovements: recentMovements.map((m) => ({
          ...m,
          quantity: Number(m.quantity),
          unitCost: m.unitCost ? Number(m.unitCost) : null,
          totalCost: m.totalCost ? Number(m.totalCost) : null,
          balanceAfter: Number(m.balanceAfter),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Returns filtered inventory movement history.
 */
const getInventoryMovements = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { feedTypeId, type, houseId, startDate, endDate, limit = 50, page = 1 } = req.query;

    const where = {
      userId,
      ...(feedTypeId ? { feedTypeId: Number(feedTypeId) } : {}),
      ...(type ? { type } : {}),
      ...(houseId ? { houseId: Number(houseId) } : {}),
      ...(startDate || endDate
        ? {
            date: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
    };

    const take = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const [total, movements] = await Promise.all([
      prisma.inventoryMovement.count({ where }),
      prisma.inventoryMovement.findMany({
        where,
        orderBy: { date: "desc" },
        take,
        skip,
        include: {
          feedType: { select: { id: true, name: true, unit: true, bagWeightKg: true } },
          house: { select: { id: true, name: true } },
          dailyRecord: { select: { id: true, date: true, houseId: true } },
          expense: {
            select: {
              id: true,
              amount: true,
              supplier: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        total,
        page: Number(page) || 1,
        limit: take,
        totalPages: Math.ceil(total / take) || 1,
        movements: movements.map((m) => ({
          ...m,
          quantity: Number(m.quantity),
          unitCost: m.unitCost ? Number(m.unitCost) : null,
          totalCost: m.totalCost ? Number(m.totalCost) : null,
          balanceAfter: Number(m.balanceAfter),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Records a manual stock adjustment or wastage report.
 * E.g., physical stock reconciliation (-4 kg damaged or +5 kg found).
 */
const recordStockAdjustment = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      feedTypeId,
      type = "ADJUSTMENT",
      quantity,
      unit,
      reason,
      date = new Date(),
      houseId,
    } = req.body;

    const fid = Number(feedTypeId);
    const adjustmentQty = Number(quantity);

    if (adjustmentQty === 0) {
      return res.status(400).json({
        success: false,
        message: "Adjustment quantity cannot be 0",
      });
    }

    // Verify ownership of feedType
    const feedType = await prisma.feedType.findFirst({
      where: { id: fid, userId },
    });

    if (!feedType) {
      return res.status(404).json({
        success: false,
        message: "Feed type not found or does not belong to your farm",
      });
    }

    // Verify house ownership if provided
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

    let adjustmentQtyInFeedUnit = adjustmentQty;
    if (unit && unit.trim()) {
      const pUnit = unit.trim().toLowerCase();
      const fUnit = (feedType.unit || "").trim().toLowerCase();
      const isKg = (u) => ["kg", "kgs", "kilogram", "kilograms"].includes(u);
      const isBag = (u) => ["bag", "bags"].includes(u);

      if (!isKg(pUnit) && !isBag(pUnit)) {
        return res.status(400).json({
          success: false,
          message: `Unsupported feed unit conversion from '${unit}'. Supported units are 'kg' and 'bags'.`,
        });
      }

      if (isBag(pUnit) && isKg(fUnit)) {
        const bagWeight = Number(feedType.bagWeightKg);
        if (!bagWeight || bagWeight <= 0) {
          return res.status(400).json({
            success: false,
            message: `Feed type '${feedType.name}' does not have a valid bag weight configured for conversion.`,
          });
        }
        adjustmentQtyInFeedUnit = adjustmentQty * bagWeight;
      } else if (isKg(pUnit) && isBag(fUnit)) {
        const bagWeight = Number(feedType.bagWeightKg);
        if (!bagWeight || bagWeight <= 0) {
          return res.status(400).json({
            success: false,
            message: `Feed type '${feedType.name}' does not have a valid bag weight configured for conversion.`,
          });
        }
        adjustmentQtyInFeedUnit = adjustmentQty / bagWeight;
      }
    }

    const currentStock = Number(feedType.currentStock);
    const newStock = currentStock + adjustmentQtyInFeedUnit;

    if (newStock < 0) {
      return res.status(400).json({
        success: false,
        message: `Adjustment of ${Math.abs(adjustmentQtyInFeedUnit)} ${feedType.unit} exceeds current stock of ${currentStock} ${feedType.unit}`,
      });
    }

    const unitCost = Number(feedType.unitCost) || 0;
    const totalCost = Math.abs(adjustmentQtyInFeedUnit) * unitCost;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update feedType currentStock
      const updatedFeed = await tx.feedType.update({
        where: { id: fid },
        data: { currentStock: newStock },
      });

      // 2. Create inventory movement
      const movement = await tx.inventoryMovement.create({
        data: {
          userId,
          feedTypeId: fid,
          houseId: verifiedHouseId,
          type,
          quantity: adjustmentQtyInFeedUnit,
          unit: feedType.unit,
          unitCost,
          totalCost,
          balanceAfter: newStock,
          date: new Date(date),
          reason: reason?.trim() || `Manual stock ${type.toLowerCase()}`,
        },
        include: {
          feedType: { select: { id: true, name: true, unit: true } },
          house: { select: { id: true, name: true } },
        },
      });

      return { updatedFeed, movement };
    });

    res.status(201).json({
      success: true,
      message: "Stock adjustment recorded successfully",
      data: {
        feedType: {
          ...result.updatedFeed,
          currentStock: Number(result.updatedFeed.currentStock),
          minimumStock: Number(result.updatedFeed.minimumStock),
          unitCost: Number(result.updatedFeed.unitCost),
          isLowStock: Number(result.updatedFeed.currentStock) <= Number(result.updatedFeed.minimumStock),
        },
        movement: {
          ...result.movement,
          quantity: Number(result.movement.quantity),
          unitCost: Number(result.movement.unitCost),
          totalCost: Number(result.movement.totalCost),
          balanceAfter: Number(result.movement.balanceAfter),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getInventorySummary,
  getInventoryMovements,
  recordStockAdjustment,
};
