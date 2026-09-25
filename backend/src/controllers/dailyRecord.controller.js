const prisma = require("../lib/prisma");
const { calculateConsumptionInFeedUnit } = require("../services/feed-unit.service");
const { isWithinCorrectionWindow, immutableRecordError } = require("../lib/correctionWindow");
const {
  getAdjustmentMaps,
  correctedMortalityOf,
  correctedEggsOf,
  sumCorrectedMortality,
  sumCorrectedEggs,
} = require("../services/correction.service");

/**
 * DAILY RECORD SCOPE SEMANTICS (HOUSE vs FLOCK)
 *
 * A DailyRecord applies to exactly one scope, encoded by `flockId`:
 *   - flockId === null  -> HOUSE scope: whole-house activity for the day.
 *   - flockId !== null  -> FLOCK scope: activity of that specific flock
 *     (which must belong to the record's house; enforced as
 *     FLOCK_HOUSE_MISMATCH).
 *
 * AGGREGATION RULE (prevents double counting): house-level and flock-level
 * rows are independent records that may describe the SAME physical activity
 * (e.g. a farmer logs 150 kg at house level AND 80/70 kg per flock).
 * Reporting MUST therefore aggregate within a single grain only:
 *   - house totals  = SUM over HOUSE-scope rows (+ optionally flock rows,
 *     never both without an explicit scope filter);
 *   - flock totals  = SUM over rows with that flockId.
 * The dashboard sums the house grain; flock views filter by flockId.
 * Never SUM(house rows + flock rows) for the same house/day.
 */
const getRecordScope = (record) => (record && record.flockId ? "FLOCK" : "HOUSE");

const runSerializable = async (operation) => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: "Serializable",
        maxWait: 15000,
        timeout: 30000,
      });
    } catch (error) {
      if (error.code !== "P2034" || attempt === 3) {
        throw error;
      }
    }
  }
};

/**
 * Creates a daily record, verifies ownership & mortality limits,
 * and if feedTypeId is specified, deducts consumed stock and logs an inventory movement.
 */
const createDailyRecord = async (req, res, next) => {
  try {
    const { houseId, flockId, date, mortality, feedUsedKg, eggsCollected, avgWeightGrams, feedTypeId } = req.body;

    const dailyRecord = await runSerializable(async (transaction) => {
      const house = await transaction.poultryHouse.findFirst({
        where: {
          id: Number(houseId),
          userId: req.user.id,
        },
        include: {
          dailyRecords: true,
        },
      });

      if (!house) {
        const error = new Error("Poultry house not found");
        error.code = "HOUSE_NOT_FOUND";
        throw error;
      }

      let flock = null;
      if (flockId) {
        flock = await transaction.flock.findFirst({
          where: {
            id: Number(flockId),
            userId: req.user.id,
          },
          include: {
            dailyRecords: { select: { id: true, mortality: true } },
            depopulationEvents: { select: { quantity: true } },
          },
        });
        if (!flock) {
          const error = new Error("Flock not found or does not belong to your farm");
          error.code = "FLOCK_NOT_FOUND";
          throw error;
        }
        if (flock.houseId !== house.id) {
          const error = new Error("Flock does not belong to the selected poultry house");
          error.code = "FLOCK_HOUSE_MISMATCH";
          throw error;
        }
      }

      let feedType = null;
      let consumedInFeedUnit = 0;
      if (feedTypeId) {
        feedType = await transaction.feedType.findFirst({
          where: {
            id: Number(feedTypeId),
            userId: req.user.id,
          },
        });

        if (!feedType) {
          const error = new Error("Feed type not found or does not belong to your farm");
          error.code = "FEED_TYPE_NOT_FOUND";
          throw error;
        }

        // Validate stock sufficiency BEFORE creation
        if (Number(feedUsedKg) > 0) {
          consumedInFeedUnit = calculateConsumptionInFeedUnit(Number(feedUsedKg), feedType);
          const currentStock = Number(feedType.currentStock);
          if (currentStock < consumedInFeedUnit) {
            const availableDisplay = `${currentStock} ${feedType.unit}`;
            const requiredDisplay = `${consumedInFeedUnit} ${feedType.unit}`;
            const error = new Error(
              `Insufficient feed stock for ${feedType.name}. Available: ${availableDisplay}, required: ${requiredDisplay}.`
            );
            error.code = "INSUFFICIENT_STOCK";
            throw error;
          }
        }
      }

      // Validate mortality against flock or house bird count.
      // Sibling sums use corrected mortality so prior corrections free
      // up (or consume) headroom instead of being ignored.
      let flockAdj = null;
      if (flock) {
        flockAdj = await getAdjustmentMaps(
          transaction,
          flock.dailyRecords.map((r) => r.id),
          req.user.id
        );
        const flockMortality = sumCorrectedMortality(flock.dailyRecords, flockAdj);
        const flockDepopulated = flock.depopulationEvents.reduce((sum, e) => sum + e.quantity, 0);
        const liveBirds = Math.max(0, flock.birdsPlaced - flockMortality - flockDepopulated);
        if (mortality > liveBirds) {
          const error = new Error(
            `Mortality cannot exceed the flock's current number of birds (${liveBirds})`
          );
          error.code = "MORTALITY_LIMIT";
          throw error;
        }
      } else {
        const houseAdj = await getAdjustmentMaps(
          transaction,
          house.dailyRecords.map((r) => r.id),
          req.user.id
        );
        const totalPreviousMortality = sumCorrectedMortality(house.dailyRecords, houseAdj);

        const currentBirds = house.birdsPlaced - totalPreviousMortality;

        if (mortality > currentBirds) {
          const error = new Error(
            `Mortality cannot exceed the current number of birds (${currentBirds})`
          );
          error.code = "MORTALITY_LIMIT";
          throw error;
        }
      }

      const record = await transaction.dailyRecord.create({
        data: {
          houseId: Number(houseId),
          flockId: flock ? flock.id : null,
          date,
          mortality,
          feedUsedKg,
          eggsCollected,
          avgWeightGrams: avgWeightGrams !== undefined && avgWeightGrams !== null ? Number(avgWeightGrams) : null,
          feedTypeId: feedType ? feedType.id : null,
        },
        include: {
          feedType: { select: { id: true, name: true, unit: true, bagWeightKg: true } },
          flock: { select: { id: true, name: true, purpose: true } },
        },
      });

      if (flock) {
        const flockMortality =
          sumCorrectedMortality(flock.dailyRecords, flockAdj) + mortality;
        const flockDepopulated = flock.depopulationEvents.reduce((sum, e) => sum + e.quantity, 0);
        await transaction.flock.update({
          where: { id: flock.id },
          data: {
            currentBirds: Math.max(0, flock.birdsPlaced - flockMortality - flockDepopulated),
          },
        });
      }

      // Integrate Feed Inventory Deduction if feedTypeId and feedUsedKg > 0
      // Shared farm stock: the FeedType row is per user (not per house);
      // house/flock on the movement only records WHERE it was consumed.
      let inventoryEffect = null;
      if (feedType && Number(feedUsedKg) > 0) {
        const currentStock = Number(feedType.currentStock);
        const balanceAfter = currentStock - consumedInFeedUnit;
        const unitCost = Number(feedType.unitCost) || 0;

        await transaction.feedType.update({
          where: { id: feedType.id },
          data: { currentStock: balanceAfter },
        });

        await transaction.inventoryMovement.create({
          data: {
            userId: req.user.id,
            feedTypeId: feedType.id,
            houseId: house.id,
            dailyRecordId: record.id,
            type: "CONSUMPTION",
            quantity: -consumedInFeedUnit,
            unit: feedType.unit,
            unitCost,
            totalCost: consumedInFeedUnit * unitCost,
            balanceAfter,
            date: new Date(date),
            reason: `Daily feed consumption for ${house.name} (${feedUsedKg} kg)`,
          },
        });

        inventoryEffect = {
          feedTypeId: feedType.id,
          feedName: feedType.name,
          unit: feedType.unit,
          feedUsedKg: Number(feedUsedKg),
          consumedInFeedUnit,
          stockBefore: currentStock,
          stockAfter: balanceAfter,
        };
      }

      return { record, inventory: inventoryEffect };
    });

    res.status(201).json({
      success: true,
      message: "Daily record created successfully",
      data: dailyRecord.record,
      inventory: dailyRecord.inventory,
    });
  } catch (error) {
    if (
      error.code === "INSUFFICIENT_STOCK" ||
      error.code === "UNSUPPORTED_UNIT" ||
      error.code === "INVALID_BAG_WEIGHT" ||
      error.code === "FLOCK_HOUSE_MISMATCH"
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === "HOUSE_NOT_FOUND" || error.code === "FLOCK_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === "FEED_TYPE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === "MORTALITY_LIMIT") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "A daily record already exists for this house and date",
      });
    }

    if (error.code === "P2034") {
      return res.status(409).json({
        success: false,
        message: "A concurrent update occurred; please retry the request",
      });
    }

    next(error);
  }
};

/**
 * Retrieves all daily records for houses owned by the authenticated user, newest first.
 */
const getDailyRecords = async (req, res, next) => {
  try {
    const { houseId, flockId } = req.query;

    const whereClause = {
      house: {
        userId: req.user.id,
      },
    };

    if (houseId) {
      whereClause.houseId = Number(houseId);
    }

    if (flockId) {
      whereClause.flockId = Number(flockId);
    }

    const records = await prisma.dailyRecord.findMany({
      where: whereClause,
      include: {
        house: true,
        flock: { select: { id: true, name: true, purpose: true } },
        feedType: { select: { id: true, name: true, unit: true, bagWeightKg: true } },
        corrections: {
          select: {
            id: true, field: true, previousValue: true,
            correctedValue: true, adjustment: true, reason: true,
            createdAt: true, user: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    // Attach corrected values (raw + append-only adjustments) so every
    // consumer sees the same corrected result without rewriting history.
    const adjMap = await getAdjustmentMaps(
      prisma,
      records.map((r) => r.id),
      req.user.id
    );

    res.json({
      success: true,
      data: records.map((r) => ({
        ...r,
        corrections: r.corrections.map((c) => ({
          ...c,
          previousValue: Number(c.previousValue),
          correctedValue: Number(c.correctedValue),
          adjustment: Number(c.adjustment),
        })),
        correctedMortality: correctedMortalityOf(r, adjMap),
        correctedEggs: correctedEggsOf(r, adjMap),
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves one daily record if it belongs to a house owned by the authenticated user.
 */
const getDailyRecordById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const record = await prisma.dailyRecord.findFirst({
      where: {
        id: Number(id),
        house: {
          userId: req.user.id,
        },
      },
      include: {
        house: true,
        feedType: { select: { id: true, name: true, unit: true, bagWeightKg: true } },
        corrections: {
          select: {
            id: true, field: true, previousValue: true,
            correctedValue: true, adjustment: true, reason: true,
            createdAt: true, user: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Daily record not found",
      });
    }

    const adjMap = await getAdjustmentMaps(prisma, [record.id], req.user.id);

    res.json({
      success: true,
      data: {
        ...record,
        corrections: record.corrections.map((c) => ({
          ...c,
          previousValue: Number(c.previousValue),
          correctedValue: Number(c.correctedValue),
          adjustment: Number(c.adjustment),
        })),
        correctedMortality: correctedMortalityOf(record, adjMap),
        correctedEggs: correctedEggsOf(record, adjMap),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates a daily record after verifying user ownership, checking mortality limits,
 * and synchronizing inventory movements.
 */
const updateDailyRecord = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { flockId, date, mortality, feedUsedKg, eggsCollected, avgWeightGrams, feedTypeId } = req.body;

    const updatedRecord = await runSerializable(async (transaction) => {
      const existingRecord = await transaction.dailyRecord.findFirst({
        where: {
          id: Number(id),
          house: {
            userId: req.user.id,
          },
        },
        include: {
          inventoryMovements: true,
          house: true,
        },
      });

      if (!existingRecord) {
        const error = new Error("Daily record not found");
        error.code = "RECORD_NOT_FOUND";
        throw error;
      }

      // Historical records outside the correction window are immutable:
      // correct them with a reversal entry instead of editing.
      if (!isWithinCorrectionWindow(existingRecord.createdAt)) {
        throw immutableRecordError("Daily record");
      }

      const house = await transaction.poultryHouse.findFirst({
        where: {
          id: existingRecord.houseId,
          userId: req.user.id,
        },
        include: {
          dailyRecords: true,
        },
      });

      // Resolve new or existing flockId
      const resolvedFlockId =
        flockId !== undefined ? (flockId ? Number(flockId) : null) : existingRecord.flockId;

      let flock = null;
      if (resolvedFlockId) {
        flock = await transaction.flock.findFirst({
          where: {
            id: resolvedFlockId,
            userId: req.user.id,
          },
          include: {
            dailyRecords: { select: { id: true, mortality: true } },
            depopulationEvents: { select: { quantity: true } },
          },
        });
        if (!flock) {
          const error = new Error("Flock not found or does not belong to your farm");
          error.code = "FLOCK_NOT_FOUND";
          throw error;
        }
        if (flock.houseId !== house.id) {
          const error = new Error("Flock does not belong to the selected poultry house");
          error.code = "FLOCK_HOUSE_MISMATCH";
          throw error;
        }
      }

      const finalMortality = mortality !== undefined ? Number(mortality) : existingRecord.mortality;

      if (flock) {
        const flockAdj = await getAdjustmentMaps(
          transaction,
          flock.dailyRecords.map((r) => r.id),
          req.user.id
        );
        const otherMortality = flock.dailyRecords
          .filter((r) => r.id !== Number(id))
          .reduce((sum, r) => sum + r.mortality + ((flockAdj.get(r.id)?.mortality) || 0), 0);
        const flockDepopulated = flock.depopulationEvents.reduce((sum, e) => sum + e.quantity, 0);
        const availableInFlock = Math.max(0, flock.birdsPlaced - otherMortality - flockDepopulated);
        if (finalMortality > availableInFlock) {
          const error = new Error(
            `Mortality cannot exceed the flock's available birds (${availableInFlock})`
          );
          error.code = "MORTALITY_LIMIT";
          throw error;
        }
      } else {
        const houseAdj = await getAdjustmentMaps(
          transaction,
          house.dailyRecords.map((r) => r.id),
          req.user.id
        );
        const totalOtherMortality = house.dailyRecords
          .filter((record) => record.id !== Number(id))
          .reduce((total, record) => total + record.mortality + ((houseAdj.get(record.id)?.mortality) || 0), 0);

        const currentBirds = house.birdsPlaced - totalOtherMortality;

        if (finalMortality > currentBirds) {
          const error = new Error(
            `Mortality cannot exceed the available birds (${currentBirds})`
          );
          error.code = "MORTALITY_LIMIT";
          throw error;
        }
      }

      // 1. Revert previous consumption if any
      const existingMovement = existingRecord.inventoryMovements.find(
        (m) => m.type === "CONSUMPTION"
      );

      if (existingMovement) {
        const prevFeed = await transaction.feedType.findUnique({
          where: { id: existingMovement.feedTypeId },
        });
        if (prevFeed) {
          // existingMovement.quantity is negative, so subtracting it adds back the consumed stock
          await transaction.feedType.update({
            where: { id: prevFeed.id },
            data: {
              currentStock: Number(prevFeed.currentStock) - Number(existingMovement.quantity),
            },
          });
        }
        await transaction.inventoryMovement.delete({
          where: { id: existingMovement.id },
        });
      }

      // 2. Resolve new feedType
      const resolvedFeedTypeId =
        feedTypeId !== undefined ? (feedTypeId ? Number(feedTypeId) : null) : existingRecord.feedTypeId;

      let newFeedType = null;
      if (resolvedFeedTypeId) {
        newFeedType = await transaction.feedType.findFirst({
          where: {
            id: resolvedFeedTypeId,
            userId: req.user.id,
          },
        });

        if (!newFeedType) {
          const error = new Error("Feed type not found or does not belong to your farm");
          error.code = "FEED_TYPE_NOT_FOUND";
          throw error;
        }
      }

      // 3. Apply new consumption if newFeedType and feedUsedKg > 0
      const finalFeedUsedKg = feedUsedKg !== undefined ? Number(feedUsedKg) : existingRecord.feedUsedKg;
      let newBalanceAfter = null;
      let inventoryEffect = null;

      if (newFeedType && finalFeedUsedKg > 0) {
        const consumedInFeedUnit = calculateConsumptionInFeedUnit(finalFeedUsedKg, newFeedType);
        // Fetch freshly updated currentStock
        const freshFeed = await transaction.feedType.findUnique({
          where: { id: newFeedType.id },
        });
        const currentAvail = Number(freshFeed.currentStock);
        newBalanceAfter = currentAvail - consumedInFeedUnit;

        if (newBalanceAfter < 0) {
          const availableDisplay = `${currentAvail} ${newFeedType.unit}`;
          const requiredDisplay = `${consumedInFeedUnit} ${newFeedType.unit}`;
          const error = new Error(
            `Insufficient feed stock for ${newFeedType.name}. Available: ${availableDisplay}, required: ${requiredDisplay}.`
          );
          error.code = "INSUFFICIENT_STOCK";
          throw error;
        }

        const unitCost = Number(freshFeed.unitCost) || 0;

        await transaction.feedType.update({
          where: { id: newFeedType.id },
          data: { currentStock: newBalanceAfter },
        });

        await transaction.inventoryMovement.create({
          data: {
            userId: req.user.id,
            feedTypeId: newFeedType.id,
            houseId: house.id,
            dailyRecordId: existingRecord.id,
            type: "CONSUMPTION",
            quantity: -consumedInFeedUnit,
            unit: newFeedType.unit,
            unitCost,
            totalCost: consumedInFeedUnit * unitCost,
            balanceAfter: newBalanceAfter,
            date: new Date(date || existingRecord.date),
            reason: `Daily feed consumption for ${house.name} (${finalFeedUsedKg} kg)`,
          },
        });

        inventoryEffect = {
          feedTypeId: newFeedType.id,
          feedName: newFeedType.name,
          unit: newFeedType.unit,
          feedUsedKg: finalFeedUsedKg,
          consumedInFeedUnit,
          stockBefore: currentAvail,
          stockAfter: newBalanceAfter,
        };
      }

      // Re-sync previous flock's currentBirds if flock changed
      if (existingRecord.flockId && existingRecord.flockId !== resolvedFlockId) {
        const prevFlock = await transaction.flock.findUnique({
          where: { id: existingRecord.flockId },
          include: {
            dailyRecords: { select: { id: true, mortality: true } },
            depopulationEvents: { select: { quantity: true } },
          },
        });
        if (prevFlock) {
          const prevMortality = prevFlock.dailyRecords
            .filter((r) => r.id !== Number(id))
            .reduce((sum, r) => sum + r.mortality, 0);
          const prevDepop = prevFlock.depopulationEvents.reduce((sum, e) => sum + e.quantity, 0);
          await transaction.flock.update({
            where: { id: prevFlock.id },
            data: { currentBirds: Math.max(0, prevFlock.birdsPlaced - prevMortality - prevDepop) },
          });
        }
      }

      if (resolvedFlockId && flock) {
        const otherMort = flock.dailyRecords
          .filter((r) => r.id !== Number(id))
          .reduce((sum, r) => sum + r.mortality, 0);
        const totalDepop = flock.depopulationEvents.reduce((sum, e) => sum + e.quantity, 0);
        await transaction.flock.update({
          where: { id: resolvedFlockId },
          data: {
            currentBirds: Math.max(0, flock.birdsPlaced - otherMort - finalMortality - totalDepop),
          },
        });
      }

      const savedRecord = await transaction.dailyRecord.update({
        where: {
          id: Number(id),
        },
        data: {
          flockId: resolvedFlockId,
          date: date !== undefined ? new Date(date) : existingRecord.date,
          mortality: finalMortality,
          feedUsedKg: finalFeedUsedKg,
          eggsCollected,
          avgWeightGrams:
            avgWeightGrams !== undefined
              ? avgWeightGrams !== null
                ? Number(avgWeightGrams)
                : null
              : existingRecord.avgWeightGrams,
          feedTypeId: newFeedType ? newFeedType.id : null,
        },
        include: {
          feedType: { select: { id: true, name: true, unit: true, bagWeightKg: true } },
          flock: { select: { id: true, name: true, purpose: true } },
          house: true,
        },
      });

      return { record: savedRecord, inventory: inventoryEffect };
    });

    res.json({
      success: true,
      message: "Daily record updated successfully",
      data: updatedRecord.record,
      inventory: updatedRecord.inventory,
    });
  } catch (error) {
    if (
      error.code === "INSUFFICIENT_STOCK" ||
      error.code === "UNSUPPORTED_UNIT" ||
      error.code === "INVALID_BAG_WEIGHT" ||
      error.code === "FLOCK_HOUSE_MISMATCH"
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === "RECORD_NOT_FOUND" || error.code === "FLOCK_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === "FEED_TYPE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === "MORTALITY_LIMIT") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === "RECORD_IMMUTABLE") {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "A daily record already exists for this house and date",
      });
    }

    if (error.code === "P2034") {
      return res.status(409).json({
        success: false,
        message: "A concurrent update occurred; please retry the request",
      });
    }

    next(error);
  }
};

/**
 * Deletes a daily record, restoring any deducted feed consumption stock.
 */
const deleteDailyRecord = async (req, res, next) => {
  try {
    const { id } = req.params;

    await runSerializable(async (tx) => {
      const record = await tx.dailyRecord.findFirst({
        where: {
          id: Number(id),
          house: {
            userId: req.user.id,
          },
        },
        include: {
          inventoryMovements: true,
        },
      });

      if (!record) {
        const error = new Error("Daily record not found");
        error.code = "RECORD_NOT_FOUND";
        throw error;
      }

      // Historical records outside the correction window are immutable:
      // correct them with a reversal entry instead of deleting.
      if (!isWithinCorrectionWindow(record.createdAt)) {
        throw immutableRecordError("Daily record");
      }

      // Revert any consumption movements
      const consumptionMovements = record.inventoryMovements.filter(
        (m) => m.type === "CONSUMPTION"
      );

      for (const mov of consumptionMovements) {
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

      // Re-sync flock currentBirds if the record had a flock
      if (record.flockId) {
        const flockToUpdate = await tx.flock.findUnique({
          where: { id: record.flockId },
          include: {
            dailyRecords: { select: { id: true, mortality: true } },
            depopulationEvents: { select: { quantity: true } },
          },
        });
        if (flockToUpdate) {
          const remainingMortality = flockToUpdate.dailyRecords
            .filter((r) => r.id !== Number(id))
            .reduce((sum, r) => sum + r.mortality, 0);
          const totalDepop = flockToUpdate.depopulationEvents.reduce((sum, e) => sum + e.quantity, 0);
          await tx.flock.update({
            where: { id: record.flockId },
            data: {
              currentBirds: Math.max(0, flockToUpdate.birdsPlaced - remainingMortality - totalDepop),
            },
          });
        }
      }

      await tx.dailyRecord.delete({
        where: {
          id: Number(id),
        },
      });
    });

    res.json({
      success: true,
      message: "Daily record deleted successfully",
    });
  } catch (error) {
    if (error.code === "RECORD_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    if (error.code === "RECORD_IMMUTABLE") {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }
    if (error.code === "P2034") {
      return res.status(409).json({
        success: false,
        message: "A concurrent update occurred; please retry the request",
      });
    }
    next(error);
  }
};

module.exports = {
  getRecordScope,
  calculateConsumptionInFeedUnit,
  createDailyRecord,
  getDailyRecords,
  getDailyRecordById,
  updateDailyRecord,
  deleteDailyRecord,
};