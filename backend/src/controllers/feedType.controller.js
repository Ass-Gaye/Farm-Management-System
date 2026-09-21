const prisma = require("../lib/prisma");

/**
 * Lists all feed types belonging to the authenticated user's farm.
 * Includes calculated lowStock indicator and summary counts.
 */
const getFeedTypes = async (req, res, next) => {
  try {
    const { active, search } = req.query;

    const where = {
      userId: req.user.id,
      ...(active !== undefined ? { active: active === "true" } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { category: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const feedTypes = await prisma.feedType.findMany({
      where,
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: {
        _count: {
          select: {
            movements: true,
            dailyRecords: true,
            expenses: true,
          },
        },
      },
    });

    const enriched = feedTypes.map((ft) => {
      const currentStock = Number(ft.currentStock);
      const minimumStock = Number(ft.minimumStock);
      const unitCost = Number(ft.unitCost);
      const isLowStock = currentStock <= minimumStock;
      const totalValuation = currentStock * unitCost;

      return {
        ...ft,
        currentStock,
        minimumStock,
        unitCost,
        isLowStock,
        totalValuation,
      };
    });

    res.json({
      success: true,
      data: enriched,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Gets a single feed type by ID with its movement history and usage statistics.
 */
const getFeedTypeById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const feedType = await prisma.feedType.findFirst({
      where: {
        id,
        userId: req.user.id,
      },
      include: {
        movements: {
          orderBy: { date: "desc" },
          take: 50,
          include: {
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
        },
        _count: {
          select: {
            movements: true,
            dailyRecords: true,
            expenses: true,
          },
        },
      },
    });

    if (!feedType) {
      return res.status(404).json({
        success: false,
        message: "Feed type not found or does not belong to your farm",
      });
    }

    const currentStock = Number(feedType.currentStock);
    const minimumStock = Number(feedType.minimumStock);
    const unitCost = Number(feedType.unitCost);
    const isLowStock = currentStock <= minimumStock;
    const totalValuation = currentStock * unitCost;

    res.json({
      success: true,
      data: {
        ...feedType,
        currentStock,
        minimumStock,
        unitCost,
        isLowStock,
        totalValuation,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Creates a new feed type for the authenticated farm.
 * If initial currentStock is specified > 0, an initial movement is recorded.
 */
const createFeedType = async (req, res, next) => {
  try {
    const {
      name,
      category = "FEED",
      description = null,
      unit = "kg",
      bagWeightKg = 50,
      minimumStock = 0,
      currentStock = 0,
      unitCost = 0,
      active = true,
    } = req.body;

    const initialQty = Number(currentStock) || 0;
    const initialCost = Number(unitCost) || 0;
    const trimmedUnit = (unit || "kg").trim().toLowerCase();

    if (trimmedUnit !== "kg" && trimmedUnit !== "bags") {
      return res.status(400).json({
        success: false,
        message: `Unsupported feed storage unit '${unit}'. Supported units are 'kg' and 'bags'.`,
      });
    }

    const parsedBagWeight = bagWeightKg !== undefined && bagWeightKg !== null ? Number(bagWeightKg) : (trimmedUnit === "bags" ? 50 : null);
    if (trimmedUnit === "bags" && (!parsedBagWeight || isNaN(parsedBagWeight) || parsedBagWeight <= 0)) {
      return res.status(400).json({
        success: false,
        message: "A valid bag weight (bagWeightKg > 0) is required when unit is bags",
      });
    }

    const created = await prisma.$transaction(async (tx) => {
      const feedType = await tx.feedType.create({
        data: {
          userId: req.user.id,
          name: name.trim(),
          category: category.trim(),
          description: description?.trim() || null,
          unit: trimmedUnit,
          bagWeightKg: parsedBagWeight,
          minimumStock: Number(minimumStock) || 0,
          currentStock: initialQty,
          unitCost: initialCost,
          active: active !== undefined ? Boolean(active) : true,
        },
      });

      if (initialQty > 0) {
        await tx.inventoryMovement.create({
          data: {
            userId: req.user.id,
            feedTypeId: feedType.id,
            type: "ADJUSTMENT",
            quantity: initialQty,
            unit: unit.trim(),
            unitCost: initialCost,
            totalCost: initialQty * initialCost,
            balanceAfter: initialQty,
            date: new Date(),
            reason: "Initial opening stock",
          },
        });
      }

      return feedType;
    });

    res.status(201).json({
      success: true,
      message: "Feed type created successfully",
      data: {
        ...created,
        currentStock: Number(created.currentStock),
        minimumStock: Number(created.minimumStock),
        unitCost: Number(created.unitCost),
        isLowStock: Number(created.currentStock) <= Number(created.minimumStock),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates metadata, thresholds, or active state of a feed type.
 */
const updateFeedType = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const existing = await prisma.feedType.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Feed type not found or does not belong to your farm",
      });
    }

    const {
      name,
      category,
      description,
      unit,
      bagWeightKg,
      minimumStock,
      unitCost,
      active,
    } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (category !== undefined) updateData.category = category.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (unit !== undefined) {
      const trimmedUnit = unit.trim().toLowerCase();
      if (trimmedUnit !== "kg" && trimmedUnit !== "bags") {
        return res.status(400).json({
          success: false,
          message: `Unsupported feed storage unit '${unit}'. Supported units are 'kg' and 'bags'.`,
        });
      }
      updateData.unit = trimmedUnit;
    }

    const effectiveUnit = updateData.unit || existing.unit;
    if (effectiveUnit === "bags") {
      const effectiveBagWeight = bagWeightKg !== undefined ? (bagWeightKg ? Number(bagWeightKg) : null) : existing.bagWeightKg;
      if (!effectiveBagWeight || isNaN(effectiveBagWeight) || effectiveBagWeight <= 0) {
        return res.status(400).json({
          success: false,
          message: "A valid bag weight (bagWeightKg > 0) is required when unit is bags",
        });
      }
      updateData.bagWeightKg = effectiveBagWeight;
    } else if (bagWeightKg !== undefined) {
      updateData.bagWeightKg = bagWeightKg ? Number(bagWeightKg) : null;
    }

    if (minimumStock !== undefined) updateData.minimumStock = Number(minimumStock);
    if (unitCost !== undefined) updateData.unitCost = Number(unitCost);
    if (active !== undefined) updateData.active = Boolean(active);

    const updated = await prisma.feedType.update({
      where: { id },
      data: updateData,
    });

    const currentStock = Number(updated.currentStock);
    const minStock = Number(updated.minimumStock);
    const uCost = Number(updated.unitCost);

    res.json({
      success: true,
      message: "Feed type updated successfully",
      data: {
        ...updated,
        currentStock,
        minimumStock: minStock,
        unitCost: uCost,
        isLowStock: currentStock <= minStock,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deletes a feed type or deactivates it if historic records exist.
 */
const deleteFeedType = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const existing = await prisma.feedType.findFirst({
      where: { id, userId: req.user.id },
      include: {
        _count: {
          select: {
            movements: true,
            dailyRecords: true,
            expenses: true,
          },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Feed type not found or does not belong to your farm",
      });
    }

    const hasReferences =
      existing._count.dailyRecords > 0 ||
      existing._count.expenses > 0 ||
      existing._count.movements > 0;

    if (hasReferences) {
      // Deactivate rather than delete to preserve historical integrity
      await prisma.feedType.update({
        where: { id },
        data: { active: false },
      });

      return res.json({
        success: true,
        message:
          "Feed type is referenced in historical records and has been deactivated instead of permanently deleted.",
        deactivated: true,
      });
    }

    await prisma.feedType.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Feed type deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFeedTypes,
  getFeedTypeById,
  createFeedType,
  updateFeedType,
  deleteFeedType,
};
