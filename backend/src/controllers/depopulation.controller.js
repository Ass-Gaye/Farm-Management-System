const prisma = require("../lib/prisma");
const { runSerializable } = require("../lib/transaction");
const {
  getAdjustmentMaps,
  sumCorrectedMortality,
} = require("../services/correction.service");

/**
 * Transaction-scoped live-bird calculation (reads via tx client so
 * concurrent mutations are serialized instead of lost).
 */
const calculateLiveBirdsTx = async (tx, flockId, excludeEventId = null) => {
  const flock = await tx.flock.findUnique({
    where: { id: flockId },
    include: {
      dailyRecords: { select: { id: true, mortality: true } },
      depopulationEvents: { select: { id: true, quantity: true } },
    },
  });

  if (!flock) {
    return null;
  }

  const adjMap = await getAdjustmentMaps(
    tx,
    flock.dailyRecords.map((r) => r.id)
  );
  const totalMortality = sumCorrectedMortality(flock.dailyRecords, adjMap);

  const totalDepopulated = flock.depopulationEvents
    .filter((e) => (excludeEventId ? e.id !== excludeEventId : true))
    .reduce((sum, e) => sum + e.quantity, 0);

  const liveBirds = Math.max(0, flock.birdsPlaced - totalMortality - totalDepopulated);

  return {
    birdsPlaced: flock.birdsPlaced,
    totalMortality,
    totalDepopulated,
    liveBirds,
  };
};

/**
 * Calculates the current live bird count for a flock by subtracting
 * total mortality (from daily records) and total depopulated birds
 * (from depopulation events) from the original birds placed.
 *
 * @param {number} flockId
 * @param {number|null} excludeEventId - Optionally exclude a specific event (for updates)
 * @returns {Promise<{birdsPlaced: number, totalMortality: number, totalDepopulated: number, liveBirds: number}>}
 */
const calculateLiveBirds = async (flockId, excludeEventId = null) => {
  const flock = await prisma.flock.findUnique({
    where: { id: flockId },
    include: {
      dailyRecords: { select: { id: true, mortality: true } },
      depopulationEvents: { select: { id: true, quantity: true } },
    },
  });

  if (!flock) {
    return null;
  }

  // Mortality sums use corrected values so historical corrections flow
  // into availability checks.
  const adjMap = await getAdjustmentMaps(
    prisma,
    flock.dailyRecords.map((r) => r.id)
  );
  const totalMortality = sumCorrectedMortality(flock.dailyRecords, adjMap);

  const totalDepopulated = flock.depopulationEvents
    .filter((e) => (excludeEventId ? e.id !== excludeEventId : true))
    .reduce((sum, e) => sum + e.quantity, 0);

  const liveBirds = Math.max(0, flock.birdsPlaced - totalMortality - totalDepopulated);

  return {
    birdsPlaced: flock.birdsPlaced,
    totalMortality,
    totalDepopulated,
    liveBirds,
  };
};

/**
 * Creates a new depopulation event for a flock.
 * Supports both /api/depopulation-events (with flockId in body)
 * and /api/flocks/:flockId/depopulation-events.
 */
const createDepopulationEvent = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const rawFlockId = req.params.flockId || req.body.flockId;
    const flockId = rawFlockId ? Number(rawFlockId) : null;
    const { quantity, reason, date, notes, incomeId } = req.body;

    if (!flockId) {
      return res.status(400).json({
        success: false,
        message: "flockId is required",
      });
    }

    const numQuantity = Number(quantity);
    if (!numQuantity || numQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be greater than 0",
      });
    }

    // All bird-count reads/writes happen inside one serializable
    // transaction (ownership, headroom, create, flock sync).
    let event;
    let liveBirdsAfter;
    try {
      const result = await runSerializable(async (tx) => {
        // Verify flock ownership inside the transaction
        const ownedFlock = await tx.flock.findFirst({
          where: { id: flockId, userId },
        });
        if (!ownedFlock) {
          const error = new Error("Flock not found or does not belong to your farm");
          error.code = "FLOCK_NOT_FOUND";
          throw error;
        }

        // Calculate available live birds inside the transaction
        const birdStats = await calculateLiveBirdsTx(tx, flockId);
        if (numQuantity > birdStats.liveBirds) {
          const error = new Error(
            `Cannot remove ${numQuantity} birds. Only ${birdStats.liveBirds} live birds available (${birdStats.birdsPlaced} placed - ${birdStats.totalMortality} mortality - ${birdStats.totalDepopulated} previously depopulated)`
          );
          error.code = "NO_HEADROOM";
          throw error;
        }

        // If incomeId is provided, verify it belongs to this user
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

        const created = await tx.depopulationEvent.create({
          data: {
            userId,
            flockId,
            quantity: numQuantity,
            reason,
            date: new Date(date),
            notes: notes ? notes.trim() : null,
            incomeId: incomeId ? Number(incomeId) : null,
          },
          include: {
            flock: { select: { id: true, name: true, batchNumber: true } },
            income: { select: { id: true, amount: true, category: true } },
          },
        });

        // Update the flock's currentBirds field in the same transaction
        const updatedStats = await calculateLiveBirdsTx(tx, flockId);
        await tx.flock.update({
          where: { id: flockId },
          data: { currentBirds: updatedStats.liveBirds },
        });

        return { created, liveBirdsAfter: updatedStats.liveBirds };
      });
      event = result.created;
      liveBirdsAfter = result.liveBirdsAfter;
    } catch (error) {
      if (error.code === "FLOCK_NOT_FOUND" || error.code === "INCOME_NOT_FOUND") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      if (error.code === "NO_HEADROOM") {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      throw error;
    }

    res.status(201).json({
      success: true,
      message: "Depopulation event recorded successfully",
      data: {
        ...event,
        liveBirdsAfter,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves depopulation events.
 * If flockId is provided (in params or query), filters by that flock and includes summary.
 * Otherwise returns all depopulation events for the authenticated user.
 */
const getDepopulationEvents = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const rawFlockId = req.params.flockId || req.query.flockId;
    const flockId = rawFlockId ? Number(rawFlockId) : null;

    if (flockId) {
      // Verify flock ownership
      const flock = await prisma.flock.findFirst({
        where: { id: flockId, userId },
      });

      if (!flock) {
        return res.status(404).json({
          success: false,
          message: "Flock not found or does not belong to your farm",
        });
      }
    }

    const where = {
      userId,
      ...(flockId ? { flockId } : {}),
    };

    const events = await prisma.depopulationEvent.findMany({
      where,
      include: {
        flock: { select: { id: true, name: true, batchNumber: true } },
        income: { select: { id: true, amount: true, category: true } },
      },
      orderBy: { date: "desc" },
    });

    // Include summary stats when flockId is specified
    const birdStats = flockId ? await calculateLiveBirds(flockId) : null;

    res.json({
      success: true,
      data: {
        events,
        summary: birdStats,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves a single depopulation event by ID.
 * Enforces authenticated user ownership.
 */
const getDepopulationEventById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const eventId = Number(req.params.id);
    const rawFlockId = req.params.flockId || req.query.flockId;
    const flockId = rawFlockId ? Number(rawFlockId) : null;

    const event = await prisma.depopulationEvent.findFirst({
      where: {
        id: eventId,
        userId,
        ...(flockId ? { flockId } : {}),
      },
      include: {
        flock: { select: { id: true, name: true, batchNumber: true } },
        income: { select: { id: true, amount: true, category: true } },
      },
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Depopulation event not found",
      });
    }

    res.json({
      success: true,
      data: event,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates an existing depopulation event.
 * Enforces authenticated user ownership and validates against live birds headroom.
 */
const updateDepopulationEvent = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const eventId = Number(req.params.id);
    const { quantity, reason, date, notes, incomeId } = req.body;

    // Verify event ownership
    const existing = await prisma.depopulationEvent.findFirst({
      where: { id: eventId, userId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Depopulation event not found",
      });
    }

    const flockId = existing.flockId;

    // Pre-validate quantity shape outside the transaction; headroom is
    // re-validated inside the transaction against fresh reads.
    const newQuantity = quantity !== undefined ? Number(quantity) : existing.quantity;
    if (quantity !== undefined && newQuantity !== existing.quantity && newQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be greater than 0",
      });
    }

    let updated;
    let liveBirdsAfter;
    try {
      const result = await runSerializable(async (tx) => {
        const ownedFlock = await tx.flock.findFirst({
          where: { id: flockId, userId },
        });
        if (!ownedFlock) {
          const error = new Error("Flock not found or does not belong to your farm");
          error.code = "FLOCK_NOT_FOUND";
          throw error;
        }

        if (quantity !== undefined && newQuantity !== existing.quantity) {
          // Exclude this event from the calculation to check available headroom
          const birdStats = await calculateLiveBirdsTx(tx, flockId, eventId);
          if (newQuantity > birdStats.liveBirds) {
            const error = new Error(
              `Cannot set quantity to ${newQuantity}. Only ${birdStats.liveBirds} live birds available after accounting for other events`
            );
            error.code = "NO_HEADROOM";
            throw error;
          }
        }

        // If incomeId is provided, verify it belongs to this user
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

        const saved = await tx.depopulationEvent.update({
          where: { id: eventId },
          data: {
            quantity: newQuantity,
            reason: reason !== undefined ? reason : existing.reason,
            date: date ? new Date(date) : existing.date,
            notes: notes !== undefined ? (notes ? notes.trim() : null) : existing.notes,
            incomeId: incomeId !== undefined ? (incomeId ? Number(incomeId) : null) : existing.incomeId,
          },
          include: {
            flock: { select: { id: true, name: true, batchNumber: true } },
            income: { select: { id: true, amount: true, category: true } },
          },
        });

        // Sync flock's currentBirds in the same transaction
        const updatedStats = await calculateLiveBirdsTx(tx, flockId);
        await tx.flock.update({
          where: { id: flockId },
          data: { currentBirds: updatedStats.liveBirds },
        });

        return { saved, liveBirdsAfter: updatedStats.liveBirds };
      });
      updated = result.saved;
      liveBirdsAfter = result.liveBirdsAfter;
    } catch (error) {
      if (error.code === "FLOCK_NOT_FOUND" || error.code === "INCOME_NOT_FOUND") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      if (error.code === "NO_HEADROOM") {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      throw error;
    }

    res.json({
      success: true,
      message: "Depopulation event updated successfully",
      data: {
        ...updated,
        liveBirdsAfter,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deletes a depopulation event and restores the flock's bird count.
 * Enforces authenticated user ownership.
 */
const deleteDepopulationEvent = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const eventId = Number(req.params.id);

    const existing = await prisma.depopulationEvent.findFirst({
      where: { id: eventId, userId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Depopulation event not found",
      });
    }

    const flockId = existing.flockId;

    const { liveBirdsAfter } = await runSerializable(async (tx) => {
      await tx.depopulationEvent.delete({
        where: { id: eventId },
      });

      // Sync flock's currentBirds in the same transaction
      const updatedStats = await calculateLiveBirdsTx(tx, flockId);
      await tx.flock.update({
        where: { id: flockId },
        data: { currentBirds: updatedStats.liveBirds },
      });

      return { liveBirdsAfter: updatedStats.liveBirds };
    });

    res.json({
      success: true,
      message: "Depopulation event deleted successfully",
      data: {
        liveBirdsAfter,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createDepopulationEvent,
  getDepopulationEvents,
  getDepopulationEventById,
  updateDepopulationEvent,
  deleteDepopulationEvent,
  calculateLiveBirds,
};
