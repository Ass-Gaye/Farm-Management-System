const prisma = require("../lib/prisma");

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
      dailyRecords: { select: { mortality: true } },
      depopulationEvents: { select: { id: true, quantity: true } },
    },
  });

  if (!flock) {
    return null;
  }

  const totalMortality = flock.dailyRecords.reduce(
    (sum, r) => sum + r.mortality,
    0
  );

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

    const numQuantity = Number(quantity);
    if (!numQuantity || numQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be greater than 0",
      });
    }

    // Calculate available live birds
    const birdStats = await calculateLiveBirds(flockId);
    if (numQuantity > birdStats.liveBirds) {
      return res.status(400).json({
        success: false,
        message: `Cannot remove ${numQuantity} birds. Only ${birdStats.liveBirds} live birds available (${birdStats.birdsPlaced} placed - ${birdStats.totalMortality} mortality - ${birdStats.totalDepopulated} previously depopulated)`,
      });
    }

    // If incomeId is provided, verify it belongs to this user
    if (incomeId) {
      const income = await prisma.income.findFirst({
        where: { id: Number(incomeId), userId },
      });
      if (!income) {
        return res.status(404).json({
          success: false,
          message: "Income record not found or does not belong to your farm",
        });
      }
    }

    const event = await prisma.depopulationEvent.create({
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

    // Update the flock's currentBirds field to stay in sync
    const updatedStats = await calculateLiveBirds(flockId);
    await prisma.flock.update({
      where: { id: flockId },
      data: { currentBirds: updatedStats.liveBirds },
    });

    res.status(201).json({
      success: true,
      message: "Depopulation event recorded successfully",
      data: {
        ...event,
        liveBirdsAfter: updatedStats.liveBirds,
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

    // If quantity is changing, validate against available birds
    const newQuantity = quantity !== undefined ? Number(quantity) : existing.quantity;
    if (quantity !== undefined && newQuantity !== existing.quantity) {
      if (newQuantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Quantity must be greater than 0",
        });
      }

      // Exclude this event from the calculation to check available headroom
      const birdStats = await calculateLiveBirds(flockId, eventId);
      if (newQuantity > birdStats.liveBirds) {
        return res.status(400).json({
          success: false,
          message: `Cannot set quantity to ${newQuantity}. Only ${birdStats.liveBirds} live birds available after accounting for other events`,
        });
      }
    }

    // If incomeId is provided, verify it belongs to this user
    if (incomeId) {
      const income = await prisma.income.findFirst({
        where: { id: Number(incomeId), userId },
      });
      if (!income) {
        return res.status(404).json({
          success: false,
          message: "Income record not found or does not belong to your farm",
        });
      }
    }

    const updated = await prisma.depopulationEvent.update({
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

    // Sync flock's currentBirds
    const updatedStats = await calculateLiveBirds(flockId);
    await prisma.flock.update({
      where: { id: flockId },
      data: { currentBirds: updatedStats.liveBirds },
    });

    res.json({
      success: true,
      message: "Depopulation event updated successfully",
      data: {
        ...updated,
        liveBirdsAfter: updatedStats.liveBirds,
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

    await prisma.depopulationEvent.delete({
      where: { id: eventId },
    });

    // Sync flock's currentBirds after deletion
    const updatedStats = await calculateLiveBirds(flockId);
    await prisma.flock.update({
      where: { id: flockId },
      data: { currentBirds: updatedStats.liveBirds },
    });

    res.json({
      success: true,
      message: "Depopulation event deleted successfully",
      data: {
        liveBirdsAfter: updatedStats.liveBirds,
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
