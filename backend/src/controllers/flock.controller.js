const prisma = require("../lib/prisma");
const { runSerializable } = require("../lib/transaction");
const { resolveTransition } = require("../services/flock-lifecycle.service");
const {
  getAdjustmentMaps,
  sumCorrectedMortality,
  sumCorrectedEggs,
  correctedEggsOf,
  correctedMortalityOf,
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
 * Sums recorded CONSUMPTION movement costs tied to the given daily
 * records. Feed purchases are farm-level; only consumption stamped with
 * a dailyRecordId can be attributed to a flock, so this is a component
 * breakdown — never added on top of Expense totals.
 */
const sumFlockFeedCost = async (client, userId, recordIds) => {
  if (!recordIds || recordIds.length === 0) return 0;
  const agg = await client.inventoryMovement.aggregate({
    where: {
      userId,
      dailyRecordId: { in: recordIds },
      type: "CONSUMPTION",
    },
    _sum: { totalCost: true },
  });
  return Number(Number(agg._sum.totalCost || 0).toFixed(2));
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

    // Financial calculations (flock-linked records only; house/farm-level
    // rows are never allocated to a flock).
    const totalFlockExpenses = flock.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalFlockRevenue = flock.income.reduce((sum, i) => sum + Number(i.amount), 0);
    const netProfitLoss = Number((totalFlockRevenue - totalFlockExpenses).toFixed(2));
    const costPerBird =
      flock.birdsPlaced > 0 ? Number((totalFlockExpenses / flock.birdsPlaced).toFixed(2)) : 0;
    const revenuePerBird =
      flock.birdsPlaced > 0 ? Number((totalFlockRevenue / flock.birdsPlaced).toFixed(2)) : 0;

    // Phase 4.3 — derived cost components (no allocation invented):
    // feedCost = actual CONSUMPTION movement costs tied to this flock's
    // daily records; vaccineCost = recorded Vaccination.cost rows.
    const recordIds = flock.dailyRecords.map((r) => r.id);
    const feedCost = await sumFlockFeedCost(prisma, userId, recordIds);
    const vaccineCost = Number(
      flock.vaccinations.reduce((sum, v) => sum + Number(v.cost || 0), 0).toFixed(2)
    );

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
          feedCost,
          vaccineCost,
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
 * Returns per-period production trends for a flock (Phase 4.3).
 * range=30d -> daily periods; range=12w -> weekly periods (Monday start).
 * Eggs/mortality use corrected values; liveBirds follows the existing
 * birdsPlaced - correctedMortality - depopulated rule at each period end.
 * Only dates with records produce periods (no fabricated rows).
 */
const getFlockTrends = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const range = String(req.query.range || "30d").toLowerCase();

    if (range !== "30d" && range !== "12w") {
      return res.status(400).json({
        success: false,
        message: 'Invalid range. Supported values are "30d" and "12w".',
      });
    }

    const flock = await prisma.flock.findFirst({
      where: { id: Number(id), userId },
      select: { id: true, name: true, birdsPlaced: true },
    });
    if (!flock) {
      return res.status(404).json({ success: false, message: "Flock not found" });
    }

    const days = range === "30d" ? 30 : 84;
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (days - 1));

    // All flock records (for cumulative bird counts) + depopulation events.
    const [allRecords, depopEvents] = await Promise.all([
      prisma.dailyRecord.findMany({
        where: { flockId: flock.id, house: { userId } },
        select: { id: true, date: true, mortality: true, feedUsedKg: true, eggsCollected: true },
        orderBy: { date: "asc" },
      }),
      prisma.depopulationEvent.findMany({
        where: { flockId: flock.id, userId },
        select: { date: true, quantity: true },
        orderBy: { date: "asc" },
      }),
    ]);

    const adjMap = await getAdjustmentMaps(
      prisma,
      allRecords.map((r) => r.id),
      userId
    );

    const dayKey = (d) => {
      const dt = new Date(d);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    };
    const weekStartKey = (d) => {
      const dt = new Date(d);
      dt.setHours(0, 0, 0, 0);
      const dow = (dt.getDay() + 6) % 7; // Monday = 0
      dt.setDate(dt.getDate() - dow);
      return dayKey(dt);
    };

    const bucketKey = range === "30d" ? dayKey : weekStartKey;
    const buckets = new Map();

    // Cumulative counts over the full history so liveBirds at each
    // period end respects the standard bird-count rule.
    let cumMortality = 0;
    let cumDepopulated = 0;
    let depopIdx = 0;

    const sortedDepops = depopEvents;
    const periodEndLive = new Map(); // bucketKey -> liveBirds at bucket end

    for (const record of allRecords) {
      const recordDate = new Date(record.date);
      while (depopIdx < sortedDepops.length && new Date(sortedDepops[depopIdx].date) <= recordDate) {
        cumDepopulated += sortedDepops[depopIdx].quantity;
        depopIdx += 1;
      }
      cumMortality += correctedMortalityOf(record, adjMap);

      if (recordDate < cutoff) continue;

      const key = bucketKey(recordDate);
      const bucket = buckets.get(key) || { eggs: 0, mortality: 0, feedKg: 0, endDate: recordDate };
      bucket.eggs += correctedEggsOf(record, adjMap);
      bucket.mortality += correctedMortalityOf(record, adjMap);
      bucket.feedKg += Number(record.feedUsedKg) || 0;
      if (recordDate >= bucket.endDate) bucket.endDate = recordDate;
      buckets.set(key, bucket);
      periodEndLive.set(
        key,
        Math.max(0, flock.birdsPlaced - cumMortality - cumDepopulated)
      );
    }

    const periods = [...buckets.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([key, b]) => ({
        date: key,
        eggs: b.eggs,
        mortality: b.mortality,
        feedKg: Number(b.feedKg.toFixed(2)),
        liveBirds: periodEndLive.get(key) ?? 0,
      }));

    res.json({
      success: true,
      data: {
        flock: { id: flock.id, name: flock.name },
        range,
        periods,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Closes or reopens a flock (Phase 4.4 operational lock).
 * Validates the transition, reconciles birds/production/egg flow/feed/
 * finance from authoritative sources, and updates the status atomically.
 * Closed flocks reject new operational records; corrections of existing
 * history remain allowed.
 */
const closeoutFlock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { status: requestedStatus, acknowledgeRemainingBirds = false, notes } = req.body;

    const summary = await runSerializable(async (tx) => {
      const flock = await tx.flock.findFirst({
        where: { id: Number(id), userId },
        include: {
          dailyRecords: {
            select: { id: true, date: true, mortality: true, feedUsedKg: true, eggsCollected: true, avgWeightGrams: true },
          },
          depopulationEvents: { select: { quantity: true } },
          expenses: { select: { amount: true } },
          income: { select: { amount: true } },
          vaccinations: { select: { cost: true } },
        },
      });

      if (!flock) {
        const error = new Error("Flock not found");
        error.code = "FLOCK_NOT_FOUND";
        throw error;
      }

      const transition = resolveTransition(flock.status, requestedStatus);

      // Reconciliation uses the exact Phase 4.3 formulas.
      const adjMap = await getAdjustmentMaps(
        tx,
        flock.dailyRecords.map((r) => r.id),
        userId
      );
      const correctedMortality = sumCorrectedMortality(flock.dailyRecords, adjMap);
      const totalDepopulated = (flock.depopulationEvents || []).reduce((sum, e) => sum + e.quantity, 0);
      const liveBirds = Math.max(0, flock.birdsPlaced - correctedMortality - totalDepopulated);
      const mortalityRate =
        flock.birdsPlaced > 0
          ? Number(((correctedMortality / flock.birdsPlaced) * 100).toFixed(2))
          : 0;

      if (
        (transition.kind === "CLOSE" || transition.kind === "RECLOSE") &&
        liveBirds > 0 &&
        acknowledgeRemainingBirds !== true
      ) {
        const error = new Error(
          `This flock still has ${liveBirds} live birds. Explicit acknowledgment is required before closing it.`
        );
        error.code = "FLOCK_REMAINING_BIRDS";
        throw error;
      }

      const totalFeedKg = flock.dailyRecords.reduce((sum, r) => sum + Number(r.feedUsedKg || 0), 0);
      const totalEggs = sumCorrectedEggs(flock.dailyRecords, adjMap);
      const daysInProd = flock.dailyRecords.length;
      const weights = flock.dailyRecords
        .filter((r) => Number(r.avgWeightGrams) > 0)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      const latestWeightGrams = weights.length > 0 ? Number(weights[0].avgWeightGrams) : null;

      const eggFlowRows = await tx.eggMovement.groupBy({
        by: ["type"],
        where: { userId, flockId: flock.id },
        _sum: { quantity: true },
      });
      const eggFlow = { produced: 0, sold: 0, wasted: 0, adjusted: 0, returned: 0, corrected: 0 };
      for (const row of eggFlowRows) {
        const qty = Number(row._sum.quantity || 0);
        if (row.type === "PRODUCTION") eggFlow.produced = qty;
        else if (row.type === "SALE") eggFlow.sold = Math.abs(qty);
        else if (row.type === "WASTAGE") eggFlow.wasted = Math.abs(qty);
        else if (row.type === "ADJUSTMENT") eggFlow.adjusted = qty;
        else if (row.type === "RETURN") eggFlow.returned = qty;
        else if (row.type === "CORRECTION") eggFlow.corrected = qty;
      }

      const recordIds = flock.dailyRecords.map((r) => r.id);
      const feedCost = await sumFlockFeedCost(tx, userId, recordIds);
      const vaccineCost = Number(
        flock.vaccinations.reduce((sum, v) => sum + Number(v.cost || 0), 0).toFixed(2)
      );
      const totalExpenses = flock.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
      const totalRevenue = flock.income.reduce((sum, i) => sum + Number(i.amount), 0);

      let updated = flock;
      if (transition.kind !== "NO_OP") {
        const trimmedNotes = notes !== undefined && notes !== null ? String(notes).trim() : "";
        const existingNotes = await tx.flock.findUnique({
          where: { id: flock.id },
          select: { notes: true },
        });
        updated = await tx.flock.update({
          where: { id: flock.id },
          data: {
            status: transition.to,
            notes:
              trimmedNotes
                ? `${existingNotes?.notes ? `${existingNotes.notes}\n` : ""}[Closeout ${transition.to} ${new Date().toISOString().split("T")[0]}] ${trimmedNotes}`
                : undefined,
          },
          select: { id: true, name: true, status: true },
        });
      }

      return {
        flock: { id: flock.id, name: flock.name },
        transition: transition.kind,
        previousStatus: transition.from,
        status: transition.kind === "NO_OP" ? transition.from : transition.to,
        acknowledgedRemainingBirds:
          (transition.kind === "CLOSE" || transition.kind === "RECLOSE") && liveBirds > 0
            ? true
            : false,
        birds: {
          birdsPlaced: flock.birdsPlaced,
          correctedMortality,
          totalDepopulated,
          liveBirds,
          mortalityRate,
        },
        production: {
          totalEggs,
          totalFeedKg: Number(totalFeedKg.toFixed(2)),
          totalMortality: correctedMortality,
          totalDepopulated,
          liveBirds,
          latestWeightGrams,
          productionDays: daysInProd,
        },
        eggFlow,
        feed: {
          totalFeedKg: Number(totalFeedKg.toFixed(2)),
          feedCost,
        },
        financials: {
          totalRevenue,
          totalExpenses,
          feedCost,
          vaccineCost,
          netProfitLoss: Number((totalRevenue - totalExpenses).toFixed(2)),
          currency: "GMD",
        },
      };
    });

    const messages = {
      CLOSE: "Flock closed successfully.",
      REOPEN: "Flock reopened successfully.",
      RECLOSE: "Flock status updated successfully.",
      NO_OP: "Flock is already in the requested status.",
    };

    res.json({ success: true, message: messages[summary.transition], data: summary });
  } catch (error) {
    if (error.code === "FLOCK_NOT_FOUND") {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.code === "FLOCK_REMAINING_BIRDS" || error.code === "INVALID_STATUS_TRANSITION") {
      return res.status(400).json({ success: false, message: error.message });
    }
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

    // Phase 4.4 — lifecycle transitions must go through the closeout
    // endpoint so validation, reconciliation, and the operational lock
    // apply. Direct status edits are rejected.
    if (status !== undefined && String(status).toUpperCase() !== String(existingFlock.status).toUpperCase()) {
      return res.status(400).json({
        success: false,
        message: "Flock status changes must use the closeout endpoint (POST /api/flocks/:id/closeout).",
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
  getFlockTrends,
  closeoutFlock,
  updateFlock,
  deleteFlock,
};
