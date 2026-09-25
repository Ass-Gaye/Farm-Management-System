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
            dailyRecord: { select: { id: true, date: true, houseId: true, flock: { select: { id: true, name: true } } } },
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

    const trimmedName = (name || "").trim();
    if (!trimmedName) {
      return res.status(400).json({
        success: false,
        message: "Feed type name is required",
      });
    }

    // Prevent duplicate feed TYPE definitions for the same product.
    // Repeat purchases must reuse the existing FeedType (via feedTypeId);
    // they must not create a second FeedType with the same name.
    const duplicate = await prisma.feedType.findFirst({
      where: {
        userId: req.user.id,
        name: { equals: trimmedName, mode: "insensitive" },
      },
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: `Feed type '${duplicate.name}' already exists. Please reuse the existing feed type for repeat purchases instead of creating a duplicate.`,
      });
    }

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
          name: trimmedName,
          category: (category || "FEED").trim(),
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
      include: {
        _count: { select: { movements: true } },
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Feed type not found or does not belong to your farm",
      });
    }

    // Unit/bag-weight lock: unit and bagWeightKg define the meaning of the
    // stored stock and every historical movement. Once stock exists or any
    // movement was recorded, silently reinterpreting them (e.g. 2,250 kg
    // becoming 2,250 bags) would corrupt inventory, so changes are rejected.
    // Create a new feed type for a different unit instead.
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
    const movementCount = existing._count?.movements || 0;
    const hasHistory = Number(existing.currentStock) !== 0 || movementCount > 0;
    const wantsUnitChange =
      unit !== undefined && unit.trim().toLowerCase() !== (existing.unit || "").trim().toLowerCase();
    const wantsBagWeightChange =
      bagWeightKg !== undefined &&
      bagWeightKg !== null &&
      bagWeightKg !== "" &&
      Number(bagWeightKg) !== Number(existing.bagWeightKg);
    if ((wantsUnitChange || wantsBagWeightChange) && hasHistory) {
      return res.status(400).json({
        success: false,
        message:
          "The feed unit cannot be changed because this feed has existing stock or historical movements. Create a new feed type if you need a different unit.",
      });
    }

    // Deactivation guard: hiding a feed with stock would silently remove
    // value from inventory valuation with no recorded movement.
    if (active !== undefined && !Boolean(active) && Number(existing.currentStock) > 0) {
      return res.status(400).json({
        success: false,
        message:
          "This feed cannot be deactivated while stock remains. Use or adjust the remaining stock first.",
      });
    }

    const updateData = {};
    if (name !== undefined) {
      const trimmedRename = (name || "").trim();
      if (!trimmedRename) {
        return res.status(400).json({
          success: false,
          message: "Feed type name is required",
        });
      }
      const duplicateRename = await prisma.feedType.findFirst({
        where: {
          userId: req.user.id,
          id: { not: id },
          name: { equals: trimmedRename, mode: "insensitive" },
        },
      });
      if (duplicateRename) {
        return res.status(409).json({
          success: false,
          message: `Feed type '${duplicateRename.name}' already exists. Please reuse the existing feed type instead of creating a duplicate.`,
        });
      }
      updateData.name = trimmedRename;
    }
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
 * Permanently deletes a feed type.
 *
 * Linked daily records and expenses keep their rows but are unlinked
 * (their feedTypeId is set to NULL). Linked inventory movements are
 * removed with the feed type. Callers that need history must therefore
 * only delete feed types whose history they are willing to lose.
 */
const deleteFeedType = async (req, res, next) => {
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

    // Never let stock silently vanish: deletion removes the feed's movement
    // history, so any remaining balance would disappear without a trace.
    if (Number(existing.currentStock) > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete "${existing.name}" while it still holds ${Number(existing.currentStock)} ${existing.unit}. Consume the stock through daily records or record a stock adjustment to bring it to zero first.`,
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
