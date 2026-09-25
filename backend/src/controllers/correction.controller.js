const prisma = require("../lib/prisma");
const { runSerializable } = require("../lib/transaction");
const { isWithinCorrectionWindow } = require("../lib/correctionWindow");
const {
  CORRECTION_FIELDS,
  getAdjustmentMaps,
  sumCorrectedMortality,
} = require("../services/correction.service");

/**
 * Creates an append-only correction for an immutable DailyRecord.
 * The original row is never modified. Mortality corrections are
 * revalidated against the full bird timeline (siblings + depopulation);
 * a correction that would invalidate later bird events is rejected.
 */
const createCorrection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { field, correctedValue, reason } = req.body;
    const userId = req.user.id;

    const result = await runSerializable(async (tx) => {
      const record = await tx.dailyRecord.findFirst({
        where: { id: Number(id), house: { userId } },
        include: {
          corrections: { orderBy: { createdAt: "asc" } },
          house: true,
        },
      });

      if (!record) {
        const error = new Error("Daily record not found");
        error.code = "RECORD_NOT_FOUND";
        throw error;
      }

      if (isWithinCorrectionWindow(record.createdAt)) {
        const error = new Error(
          "This record is still within the correction window. Edit it directly instead of creating a correction."
        );
        error.code = "STILL_EDITABLE";
        throw error;
      }

      const priorAdj = record.corrections
        .filter((c) => c.field === field)
        .reduce((sum, c) => sum + Number(c.adjustment), 0);
      const rawValue = field === "MORTALITY" ? record.mortality : record.eggsCollected;
      const previousCorrected = rawValue + priorAdj;
      const adjustment = Number(correctedValue) - previousCorrected;

      if (adjustment === 0) {
        const error = new Error("Corrected value matches the current value. No correction needed.");
        error.code = "NO_CHANGE";
        throw error;
      }

      let affectedFlockId = null;

      if (field === "MORTALITY") {
        if (record.flockId) {
          // Flock-level record: validate against the flock timeline.
          const flock = await tx.flock.findFirst({
            where: { id: record.flockId, userId },
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
          const map = await getAdjustmentMaps(
            tx,
            flock.dailyRecords.map((r) => r.id),
            userId
          );
          const othersSum = flock.dailyRecords
            .filter((r) => r.id !== record.id)
            .reduce(
              (sum, r) => sum + r.mortality + ((map.get(r.id)?.mortality) || 0),
              0
            );
          const depopTotal = flock.depopulationEvents.reduce((s, e) => s + e.quantity, 0);
          const available = flock.birdsPlaced - othersSum - depopTotal;
          if (Number(correctedValue) > available) {
            const error = new Error(
              `Correction rejected: mortality of ${correctedValue} would exceed the flock's available birds (${available} = ${flock.birdsPlaced} placed - ${othersSum} other mortality - ${depopTotal} depopulated). Later bird events would become invalid.`
            );
            error.code = "TIMELINE_CONFLICT";
            throw error;
          }
          affectedFlockId = flock.id;
        } else {
          // House-level record: validate against the house timeline.
          const house = await tx.poultryHouse.findFirst({
            where: { id: record.houseId, userId },
            include: {
              dailyRecords: { select: { id: true, mortality: true } },
              flocks: {
                include: { depopulationEvents: { select: { quantity: true } } },
              },
            },
          });
          if (!house) {
            const error = new Error("Poultry house not found");
            error.code = "HOUSE_NOT_FOUND";
            throw error;
          }
          const map = await getAdjustmentMaps(
            tx,
            house.dailyRecords.map((r) => r.id),
            userId
          );
          const othersSum = house.dailyRecords
            .filter((r) => r.id !== record.id)
            .reduce(
              (sum, r) => sum + r.mortality + ((map.get(r.id)?.mortality) || 0),
              0
            );
          const depopTotal = (house.flocks || []).reduce(
            (t, f) => t + (f.depopulationEvents || []).reduce((s, e) => s + e.quantity, 0),
            0
          );
          const available = house.birdsPlaced - othersSum - depopTotal;
          if (Number(correctedValue) > available) {
            const error = new Error(
              `Correction rejected: mortality of ${correctedValue} would exceed the house's available birds (${available} = ${house.birdsPlaced} placed - ${othersSum} other mortality - ${depopTotal} depopulated). Later bird events would become invalid.`
            );
            error.code = "TIMELINE_CONFLICT";
            throw error;
          }
        }
      }

      const correction = await tx.dailyRecordCorrection.create({
        data: {
          userId,
          dailyRecordId: record.id,
          field,
          previousValue: previousCorrected,
          correctedValue: Number(correctedValue),
          adjustment,
          reason: reason.trim(),
        },
        include: { user: { select: { id: true, name: true } } },
      });

      // Keep the stored flock counter consistent with corrected mortality.
      if (field === "MORTALITY" && affectedFlockId) {
        const flock = await tx.flock.findUnique({
          where: { id: affectedFlockId },
          include: {
            dailyRecords: { select: { id: true, mortality: true } },
            depopulationEvents: { select: { quantity: true } },
          },
        });
        const map = await getAdjustmentMaps(
          tx,
          flock.dailyRecords.map((r) => r.id),
          userId
        );
        const totalMortality = sumCorrectedMortality(flock.dailyRecords, map);
        const depopTotal = flock.depopulationEvents.reduce((s, e) => s + e.quantity, 0);
        await tx.flock.update({
          where: { id: affectedFlockId },
          data: {
            currentBirds: Math.max(0, flock.birdsPlaced - totalMortality - depopTotal),
          },
        });
      }

      return { correction, correctedResult: previousCorrected + adjustment };
    });

    res.status(201).json({
      success: true,
      message: "Correction recorded successfully. The original record is unchanged.",
      data: {
        ...result.correction,
        previousValue: Number(result.correction.previousValue),
        correctedValue: Number(result.correction.correctedValue),
        adjustment: Number(result.correction.adjustment),
        correctedResult: result.correctedResult,
      },
    });
  } catch (error) {
    if (error.code === "RECORD_NOT_FOUND" || error.code === "FLOCK_NOT_FOUND") {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (
      error.code === "STILL_EDITABLE" ||
      error.code === "NO_CHANGE" ||
      error.code === "TIMELINE_CONFLICT"
    ) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.code === "HOUSE_NOT_FOUND") {
      return res.status(404).json({ success: false, message: error.message });
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
 * Lists corrections for a daily record (audit trail), newest last.
 */
const getCorrections = async (req, res, next) => {
  try {
    const { id } = req.params;

    const record = await prisma.dailyRecord.findFirst({
      where: { id: Number(id), house: { userId: req.user.id } },
      select: { id: true },
    });
    if (!record) {
      return res.status(404).json({ success: false, message: "Daily record not found" });
    }

    const corrections = await prisma.dailyRecordCorrection.findMany({
      where: { dailyRecordId: record.id },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });

    res.json({
      success: true,
      data: corrections.map((c) => ({
        ...c,
        previousValue: Number(c.previousValue),
        correctedValue: Number(c.correctedValue),
        adjustment: Number(c.adjustment),
      })),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { CORRECTION_FIELDS, createCorrection, getCorrections };
