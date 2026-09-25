const prisma = require("../lib/prisma");
const {
  getAdjustmentMaps,
  sumCorrectedMortality,
  sumCorrectedEggs,
  correctedEggsOf,
} = require("../services/correction.service");

/**
 * Helper to calculate dynamic flock age from placement date.
 */
const calculateFlockAge = (placementDate) => {
  const now = new Date();
  const placed = new Date(placementDate);
  const diffTime = Math.max(0, now.getTime() - placed.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 7) {
    return {
      days: diffDays,
      weeks: 0,
      formatted: `${diffDays} day${diffDays === 1 ? "" : "s"} old`,
    };
  }

  const weeks = Math.floor(diffDays / 7);
  const remDays = diffDays % 7;
  const formatted =
    remDays === 0
      ? `${weeks} week${weeks === 1 ? "" : "s"} old`
      : `${weeks} wk${weeks === 1 ? "" : "s"}, ${remDays} day${remDays === 1 ? "" : "s"} old`;

  return {
    days: diffDays,
    weeks,
    formatted,
  };
};

/**
 * Creates a new flock / batch.
 */
const createFlock = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      houseId,
      breedId,
      name,
      batchNumber,
      purpose = "BROILER",
      birdsPlaced,
      placementDate,
      expectedMarketDate,
      targetWeightKg,
      status = "ACTIVE",
      notes,
    } = req.body;

    // Verify house ownership
    const house = await prisma.poultryHouse.findFirst({
      where: { id: Number(houseId), userId },
    });

    if (!house) {
      return res.status(404).json({
        success: false,
        message: "Poultry house not found or does not belong to your farm",
      });
    }

    // Verify breed ownership if specified
    if (breedId) {
      const breed = await prisma.breed.findFirst({
        where: { id: Number(breedId), houseId: Number(houseId) },
      });
      if (!breed) {
        return res.status(404).json({
          success: false,
          message: "Breed not found or does not belong to the selected house",
        });
      }
    }

    const flock = await prisma.flock.create({
      data: {
        userId,
        houseId: Number(houseId),
        breedId: breedId ? Number(breedId) : null,
        name: name.trim(),
        batchNumber: batchNumber ? batchNumber.trim() : null,
        purpose,
        birdsPlaced: Number(birdsPlaced),
        currentBirds: Number(birdsPlaced),
        placementDate: new Date(placementDate),
        expectedMarketDate: expectedMarketDate ? new Date(expectedMarketDate) : null,
        targetWeightKg: targetWeightKg ? Number(targetWeightKg) : null,
        status,
        notes: notes ? notes.trim() : null,
      },
      include: {
        house: { select: { id: true, name: true } },
        breed: { select: { id: true, name: true } },
      },
    });

    res.status(201).json({
      success: true,
      message: "Flock created successfully",
      data: {
        ...flock,
        age: calculateFlockAge(flock.placementDate),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves all flocks for the authenticated user with filters.
 */
const getFlocks = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { houseId, status, purpose, breedId, search } = req.query;

    const where = {
      userId,
      ...(houseId ? { houseId: Number(houseId) } : {}),
      ...(status ? { status: String(status) } : {}),
      ...(purpose ? { purpose: String(purpose) } : {}),
      ...(breedId ? { breedId: Number(breedId) } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: String(search), mode: "insensitive" } },
              { batchNumber: { contains: String(search), mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const flocks = await prisma.flock.findMany({
      where,
      include: {
        house: { select: { id: true, name: true } },
        breed: { select: { id: true, name: true } },
        dailyRecords: {
          select: {
            id: true,
            mortality: true,
            feedUsedKg: true,
            eggsCollected: true,
            avgWeightGrams: true,
            date: true,
          },
        },
        depopulationEvents: {
          select: { quantity: true },
        },
      },
      orderBy: { placementDate: "desc" },
    });

    // One batched query for append-only corrections across all flocks;
    // corrected mortality/eggs flow into every derived figure below.
    const allRecordIds = flocks.flatMap((f) => f.dailyRecords.map((r) => r.id));
    const adjMap = await getAdjustmentMaps(prisma, allRecordIds, userId);

    const enriched = flocks.map((flock) => {
      const totalMortality = sumCorrectedMortality(flock.dailyRecords, adjMap);
      const totalDepopulated = (flock.depopulationEvents || []).reduce((sum, e) => sum + e.quantity, 0);
      const totalFeedUsedKg = flock.dailyRecords.reduce((sum, r) => sum + r.feedUsedKg, 0);
      const totalEggs = sumCorrectedEggs(flock.dailyRecords, adjMap);
      const mortalityRate =
        flock.birdsPlaced > 0
          ? Number(((totalMortality / flock.birdsPlaced) * 100).toFixed(2))
          : 0;

      const liveBirds = Math.max(0, flock.birdsPlaced - totalMortality - totalDepopulated);

      // Latest recorded average bird weight
      const recordsWithWeight = flock.dailyRecords
        .filter((r) => r.avgWeightGrams && r.avgWeightGrams > 0)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      const latestAvgWeightGrams = recordsWithWeight.length > 0 ? recordsWithWeight[0].avgWeightGrams : null;

      // FCR calculation if weight available
      let fcr = null;
      if (latestAvgWeightGrams && latestAvgWeightGrams > 0 && liveBirds > 0) {
        const totalLiveWeightKg = (liveBirds * latestAvgWeightGrams) / 1000;
        if (totalLiveWeightKg > 0) {
          fcr = Number((totalFeedUsedKg / totalLiveWeightKg).toFixed(2));
        }
      }

      // Hen-Day Laying Rate % for latest day if purpose is LAYER
      let latestLayingRate = null;
      if (flock.purpose === "LAYER" && liveBirds > 0 && flock.dailyRecords.length > 0) {
        const sortedRecords = [...flock.dailyRecords].sort((a, b) => new Date(b.date) - new Date(a.date));
        const latestRecord = sortedRecords[0];
        latestLayingRate = Number(((correctedEggsOf(latestRecord, adjMap) / liveBirds) * 100).toFixed(1));
      }

      return {
        id: flock.id,
        name: flock.name,
        batchNumber: flock.batchNumber,
        purpose: flock.purpose,
        houseId: flock.houseId,
        houseName: flock.house.name,
        breedId: flock.breedId,
        breedName: flock.breed?.name || null,
        birdsPlaced: flock.birdsPlaced,
        currentBirds: liveBirds,
        totalMortality,
        totalDepopulated,
        mortalityRate,
        totalFeedUsedKg: Number(totalFeedUsedKg.toFixed(2)),
        totalEggs,
        latestAvgWeightGrams,
        fcr,
        latestLayingRate,
        placementDate: flock.placementDate,
        expectedMarketDate: flock.expectedMarketDate,
        targetWeightKg: flock.targetWeightKg,
        status: flock.status,
        age: calculateFlockAge(flock.placementDate),
        notes: flock.notes,
        createdAt: flock.createdAt,
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
 * Retrieves a single flock by ID with full performance analytics.
 */
const getFlockById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const flock = await prisma.flock.findFirst({
      where: { id: Number(id), userId },
      include: {
        house: { select: { id: true, name: true } },
        breed: { select: { id: true, name: true } },
        dailyRecords: {
          include: {
            feedType: { select: { id: true, name: true, unit: true } },
          },
          orderBy: { date: "desc" },
        },
        vaccinations: {
          orderBy: { scheduledDate: "asc" },
        },
        birdConditions: {
          orderBy: { recordDate: "desc" },
        },
        slaughterPlans: {
          orderBy: { expectedSlaughterDate: "asc" },
        },
        expenses: {
          orderBy: { date: "desc" },
        },
        income: {
          orderBy: { date: "desc" },
        },
        depopulationEvents: {
          include: {
            income: { select: { id: true, amount: true, category: true } },
          },
          orderBy: { date: "desc" },
        },
      },
    });

    if (!flock) {
      return res.status(404).json({
        success: false,
        message: "Flock not found",
      });
    }

    // Performance Calculations (corrected values include append-only
    // adjustments so historical corrections flow into reporting).
    const adjMap = await getAdjustmentMaps(
      prisma,
      flock.dailyRecords.map((r) => r.id),
      userId
    );
    const totalMortality = sumCorrectedMortality(flock.dailyRecords, adjMap);
    const totalDepopulated = (flock.depopulationEvents || []).reduce((sum, e) => sum + e.quantity, 0);
    const totalFeedKg = flock.dailyRecords.reduce((sum, r) => sum + r.feedUsedKg, 0);
    const totalEggs = sumCorrectedEggs(flock.dailyRecords, adjMap);
    const liveBirds = Math.max(0, flock.birdsPlaced - totalMortality - totalDepopulated);

    const mortalityRate =
      flock.birdsPlaced > 0
        ? Number(((totalMortality / flock.birdsPlaced) * 100).toFixed(2))
        : 0;

    // Days in production
    const daysInProd = Math.max(1, flock.dailyRecords.length);
    const avgDailyFeedKg = Number((totalFeedKg / daysInProd).toFixed(2));
    const avgFeedPerBirdGrams =
      liveBirds > 0 ? Number(((totalFeedKg * 1000) / (flock.birdsPlaced * daysInProd)).toFixed(1)) : 0;

    // Weight and FCR
    const recordsWithWeight = flock.dailyRecords
      .filter((r) => r.avgWeightGrams && r.avgWeightGrams > 0)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const latestWeightGrams = recordsWithWeight.length > 0 ? recordsWithWeight[0].avgWeightGrams : null;

    let fcr = null;
    if (latestWeightGrams && liveBirds > 0) {
      const totalLiveKg = (liveBirds * latestWeightGrams) / 1000;
      if (totalLiveKg > 0) {
        fcr = Number((totalFeedKg / totalLiveKg).toFixed(2));
      }
    }

    // Laying rate analytics
    let averageLayingRate = null;
    let latestLayingRate = null;
    if (flock.purpose === "LAYER" && liveBirds > 0) {
      const totalPossibleEggs = liveBirds * daysInProd;
      if (totalPossibleEggs > 0) {
        averageLayingRate = Number(((totalEggs / totalPossibleEggs) * 100).toFixed(1));
      }
      if (flock.dailyRecords.length > 0) {
        const latestCorrectedEggs = correctedEggsOf(flock.dailyRecords[0], adjMap);
        latestLayingRate = Number(((latestCorrectedEggs / liveBirds) * 100).toFixed(1));
      }
    }

    // Financial calculations
    const totalFlockExpenses = flock.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalFlockRevenue = flock.income.reduce((sum, i) => sum + Number(i.amount), 0);
    const netProfitLoss = Number((totalFlockRevenue - totalFlockExpenses).toFixed(2));
    const costPerBird =
      flock.birdsPlaced > 0 ? Number((totalFlockExpenses / flock.birdsPlaced).toFixed(2)) : 0;
    const revenuePerBird =
      flock.birdsPlaced > 0 ? Number((totalFlockRevenue / flock.birdsPlaced).toFixed(2)) : 0;

    // Pending vs completed vaccinations
    const pendingVaccinations = flock.vaccinations.filter((v) => v.status === "PENDING").length;

    res.json({
      success: true,
      data: {
        id: flock.id,
        name: flock.name,
        batchNumber: flock.batchNumber,
        purpose: flock.purpose,
        status: flock.status,
        houseId: flock.houseId,
        house: flock.house,
        breedId: flock.breedId,
        breed: flock.breed,
        birdsPlaced: flock.birdsPlaced,
        currentBirds: liveBirds,
        placementDate: flock.placementDate,
        expectedMarketDate: flock.expectedMarketDate,
        targetWeightKg: flock.targetWeightKg,
        notes: flock.notes,
        createdAt: flock.createdAt,
        age: calculateFlockAge(flock.placementDate),
        performance: {
          totalMortality,
          totalDepopulated,
          mortalityRate,
          totalFeedKg: Number(totalFeedKg.toFixed(2)),
          avgDailyFeedKg,
          avgFeedPerBirdGrams,
          totalEggs,
          averageLayingRate,
          latestLayingRate,
          latestWeightGrams,
          fcr,
          targetWeightKg: flock.targetWeightKg,
        },
        financials: {
          totalExpenses: totalFlockExpenses,
          totalRevenue: totalFlockRevenue,
          netProfitLoss,
          costPerBird,
          revenuePerBird,
          currency: "GMD",
        },
        healthSummary: {
          pendingVaccinations,
          totalConditionsLogged: flock.birdConditions.length,
        },
        dailyRecords: flock.dailyRecords,
        vaccinations: flock.vaccinations,
        birdConditions: flock.birdConditions,
        slaughterPlans: flock.slaughterPlans,
        expenses: flock.expenses,
        income: flock.income,
        depopulationEvents: flock.depopulationEvents,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates a flock.
 */
const updateFlock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      houseId,
      breedId,
      name,
      batchNumber,
      purpose,
      birdsPlaced,
      placementDate,
      expectedMarketDate,
      targetWeightKg,
      status,
      notes,
    } = req.body;

    const existingFlock = await prisma.flock.findFirst({
      where: { id: Number(id), userId },
      include: {
        dailyRecords: { select: { id: true, mortality: true } },
        depopulationEvents: { select: { quantity: true } },
      },
    });

    if (!existingFlock) {
      return res.status(404).json({
        success: false,
        message: "Flock not found",
      });
    }

    const flockAdj = await getAdjustmentMaps(
      prisma,
      existingFlock.dailyRecords.map((r) => r.id),
      userId
    );
    const totalMortality = sumCorrectedMortality(existingFlock.dailyRecords, flockAdj);
    const totalDepopulated = (existingFlock.depopulationEvents || []).reduce((sum, e) => sum + e.quantity, 0);

    const newBirdsPlaced = birdsPlaced !== undefined ? Number(birdsPlaced) : existingFlock.birdsPlaced;

    if (newBirdsPlaced < totalMortality + totalDepopulated) {
      return res.status(400).json({
        success: false,
        message: `Birds placed (${newBirdsPlaced}) cannot be less than recorded mortality (${totalMortality}) + depopulated birds (${totalDepopulated})`,
      });
    }

    const updated = await prisma.flock.update({
      where: { id: Number(id) },
      data: {
        houseId: houseId !== undefined ? Number(houseId) : existingFlock.houseId,
        breedId: breedId !== undefined ? (breedId ? Number(breedId) : null) : existingFlock.breedId,
        name: name !== undefined ? name.trim() : existingFlock.name,
        batchNumber: batchNumber !== undefined ? (batchNumber ? batchNumber.trim() : null) : existingFlock.batchNumber,
        purpose: purpose !== undefined ? purpose : existingFlock.purpose,
        birdsPlaced: newBirdsPlaced,
        currentBirds: Math.max(0, newBirdsPlaced - totalMortality - totalDepopulated),
        placementDate: placementDate ? new Date(placementDate) : existingFlock.placementDate,
        expectedMarketDate:
          expectedMarketDate !== undefined
            ? expectedMarketDate
              ? new Date(expectedMarketDate)
              : null
            : existingFlock.expectedMarketDate,
        targetWeightKg:
          targetWeightKg !== undefined
            ? targetWeightKg
              ? Number(targetWeightKg)
              : null
            : existingFlock.targetWeightKg,
        status: status !== undefined ? status : existingFlock.status,
        notes: notes !== undefined ? (notes ? notes.trim() : null) : existingFlock.notes,
      },
      include: {
        house: { select: { id: true, name: true } },
        breed: { select: { id: true, name: true } },
      },
    });

    res.json({
      success: true,
      message: "Flock updated successfully",
      data: {
        ...updated,
        age: calculateFlockAge(updated.placementDate),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deletes a flock.
 */
const deleteFlock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const existing = await prisma.flock.findFirst({
      where: { id: Number(id), userId },
      include: {
        _count: {
          select: {
            dailyRecords: true,
            depopulationEvents: true,
            vaccinations: true,
            expenses: true,
            income: true,
            birdConditions: true,
            slaughterPlans: true,
          },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Flock not found",
      });
    }

    const counts = existing._count || {};
    const hasHistory =
      (counts.dailyRecords || 0) > 0 ||
      (counts.depopulationEvents || 0) > 0 ||
      (counts.vaccinations || 0) > 0 ||
      (counts.expenses || 0) > 0 ||
      (counts.income || 0) > 0 ||
      (counts.birdConditions || 0) > 0 ||
      (counts.slaughterPlans || 0) > 0;

    if (hasHistory) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete this flock because it has historical records. Archive/deactivate it instead.",
      });
    }

    await prisma.flock.delete({
      where: { id: Number(id) },
    });

    res.json({
      success: true,
      message: "Flock deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createFlock,
  getFlocks,
  getFlockById,
  updateFlock,
  deleteFlock,
};
