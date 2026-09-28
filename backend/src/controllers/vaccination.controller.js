const prisma = require("../lib/prisma");

/**
 * Standard vaccination program templates for The Gambia / West Africa poultry.
 */
const VACCINATION_TEMPLATES = {
  BROILER: [
    {
      vaccineName: "Newcastle Disease + Infectious Bronchitis (ND+IB)",
      disease: "Newcastle / Bronchitis",
      targetAgeDays: 1,
      dosage: "1 drop eye/nostril or drinking water",
      notes: "Hatchery administration or Day 1 arrival",
    },
    {
      vaccineName: "Gumboro (IBD - Intermediate)",
      disease: "Infectious Bursal Disease (Gumboro)",
      targetAgeDays: 7,
      dosage: "Drinking water",
      notes: "First Gumboro dose",
    },
    {
      vaccineName: "Gumboro Booster (IBD)",
      disease: "Infectious Bursal Disease (Gumboro)",
      targetAgeDays: 14,
      dosage: "Drinking water",
      notes: "Second Gumboro booster",
    },
    {
      vaccineName: "Newcastle Disease (LaSota)",
      disease: "Newcastle Disease",
      targetAgeDays: 21,
      dosage: "Drinking water",
      notes: "LaSota booster strain",
    },
  ],
  LAYER: [
    {
      vaccineName: "Marek's Disease",
      disease: "Marek's Disease",
      targetAgeDays: 1,
      dosage: "Subcutaneous injection",
      notes: "At hatchery / Day 1",
    },
    {
      vaccineName: "Newcastle Disease + IB (ND+IB)",
      disease: "Newcastle / Bronchitis",
      targetAgeDays: 7,
      dosage: "Drinking water",
      notes: "First ND vaccination",
    },
    {
      vaccineName: "Gumboro (IBD - Intermediate)",
      disease: "Gumboro",
      targetAgeDays: 10,
      dosage: "Drinking water",
      notes: "First IBD dose",
    },
    {
      vaccineName: "Gumboro Booster (IBD)",
      disease: "Gumboro",
      targetAgeDays: 17,
      dosage: "Drinking water",
      notes: "Second IBD booster",
    },
    {
      vaccineName: "Newcastle LaSota Booster",
      disease: "Newcastle Disease",
      targetAgeDays: 28,
      dosage: "Drinking water",
      notes: "Four-week booster",
    },
    {
      vaccineName: "Fowl Pox",
      disease: "Fowl Pox",
      targetAgeDays: 42,
      dosage: "Wing web puncture",
      notes: "Week 6 immunity",
    },
    {
      vaccineName: "Deworming (Piperazine/Levamisole)",
      disease: "Internal Parasites",
      targetAgeDays: 56,
      dosage: "Drinking water",
      notes: "Week 8 deworming program",
    },
    {
      vaccineName: "Egg Drop Syndrome (EDS)",
      disease: "EDS '76",
      targetAgeDays: 112,
      dosage: "Intramuscular injection",
      notes: "Pre-laying protection (Week 16)",
    },
  ],
};

/**
 * Creates a single vaccination schedule entry for a flock.
 */
const createVaccination = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      flockId,
      vaccineName,
      disease,
      targetAgeDays,
      scheduledDate,
      administeredDate,
      status = "PENDING",
      dosage,
      administeredBy,
      cost,
      notes,
    } = req.body;

    // Verify flock ownership
    const flock = await prisma.flock.findFirst({
      where: { id: Number(flockId), userId },
    });

    if (!flock) {
      return res.status(404).json({
        success: false,
        message: "Flock not found or does not belong to your farm",
      });
    }

    // Phase 4.4 — closed flocks reject new operational records.
    if (flock.status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: `This flock ("${flock.name}") is closed and cannot receive new operational records. Reopen the flock first.`,
      });
    }

    const vaccination = await prisma.vaccination.create({
      data: {
        userId,
        flockId: Number(flockId),
        vaccineName: vaccineName.trim(),
        disease: disease ? disease.trim() : null,
        targetAgeDays: targetAgeDays !== undefined && targetAgeDays !== null ? Number(targetAgeDays) : null,
        scheduledDate: new Date(scheduledDate),
        administeredDate: administeredDate ? new Date(administeredDate) : null,
        status,
        dosage: dosage ? dosage.trim() : null,
        administeredBy: administeredBy ? administeredBy.trim() : null,
        cost: cost !== undefined && cost !== null && cost !== "" ? Number(cost) : 0,
        notes: notes ? notes.trim() : null,
      },
      include: {
        flock: { select: { id: true, name: true, purpose: true } },
      },
    });

    res.status(201).json({
      success: true,
      message: "Vaccination scheduled successfully",
      data: vaccination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Auto-generates a recommended vaccination program for a flock based on its purpose & placement date.
 */
const applyVaccinationTemplate = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { flockId } = req.body;

    const flock = await prisma.flock.findFirst({
      where: { id: Number(flockId), userId },
    });

    if (!flock) {
      return res.status(404).json({
        success: false,
        message: "Flock not found or does not belong to your farm",
      });
    }

    // Phase 4.4 — closed flocks reject new operational records.
    if (flock.status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: `This flock ("${flock.name}") is closed and cannot receive new operational records. Reopen the flock first.`,
      });
    }

    const templateType = flock.purpose === "LAYER" ? "LAYER" : "BROILER";
    const schedule = VACCINATION_TEMPLATES[templateType] || VACCINATION_TEMPLATES.BROILER;
    const placementTime = new Date(flock.placementDate).getTime();

    const createdItems = [];
    for (const item of schedule) {
      const scheduledDate = new Date(placementTime + item.targetAgeDays * 24 * 60 * 60 * 1000);
      const created = await prisma.vaccination.create({
        data: {
          userId,
          flockId: flock.id,
          vaccineName: item.vaccineName,
          disease: item.disease,
          targetAgeDays: item.targetAgeDays,
          scheduledDate,
          dosage: item.dosage,
          notes: item.notes,
          status: "PENDING",
        },
      });
      createdItems.push(created);
    }

    res.status(201).json({
      success: true,
      message: `Generated ${createdItems.length} recommended vaccinations for flock '${flock.name}'`,
      data: createdItems,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves all vaccinations with filtering.
 */
const getVaccinations = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { flockId, status, upcoming } = req.query;

    const where = {
      userId,
      ...(flockId ? { flockId: Number(flockId) } : {}),
      ...(status ? { status: String(status) } : {}),
    };

    if (upcoming === "true") {
      where.status = "PENDING";
      where.scheduledDate = {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // from today backwards 1 day
      };
    }

    const vaccinations = await prisma.vaccination.findMany({
      where,
      include: {
        flock: {
          select: {
            id: true,
            name: true,
            purpose: true,
            house: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { scheduledDate: "asc" },
    });

    res.json({
      success: true,
      data: vaccinations.map((v) => ({
        ...v,
        cost: Number(v.cost || 0),
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates or marks a vaccination completed.
 */
const updateVaccination = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      vaccineName,
      disease,
      targetAgeDays,
      scheduledDate,
      administeredDate,
      status,
      dosage,
      administeredBy,
      cost,
      notes,
    } = req.body;

    const existing = await prisma.vaccination.findFirst({
      where: { id: Number(id), userId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Vaccination record not found",
      });
    }

    const effectiveAdminDate =
      administeredDate !== undefined
        ? administeredDate
          ? new Date(administeredDate)
          : null
        : status === "COMPLETED" && !existing.administeredDate
          ? new Date()
          : existing.administeredDate;

    const updated = await prisma.vaccination.update({
      where: { id: Number(id) },
      data: {
        vaccineName: vaccineName !== undefined ? vaccineName.trim() : existing.vaccineName,
        disease: disease !== undefined ? (disease ? disease.trim() : null) : existing.disease,
        targetAgeDays:
          targetAgeDays !== undefined
            ? targetAgeDays !== null
              ? Number(targetAgeDays)
              : null
            : existing.targetAgeDays,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : existing.scheduledDate,
        administeredDate: effectiveAdminDate,
        status: status !== undefined ? status : existing.status,
        dosage: dosage !== undefined ? (dosage ? dosage.trim() : null) : existing.dosage,
        administeredBy:
          administeredBy !== undefined ? (administeredBy ? administeredBy.trim() : null) : existing.administeredBy,
        cost: cost !== undefined ? (cost !== null && cost !== "" ? Number(cost) : 0) : existing.cost,
        notes: notes !== undefined ? (notes ? notes.trim() : null) : existing.notes,
      },
      include: {
        flock: { select: { id: true, name: true } },
      },
    });

    res.json({
      success: true,
      message: "Vaccination updated successfully",
      data: {
        ...updated,
        cost: Number(updated.cost || 0),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deletes a vaccination record.
 */
const deleteVaccination = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const existing = await prisma.vaccination.findFirst({
      where: { id: Number(id), userId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Vaccination record not found",
      });
    }

    await prisma.vaccination.delete({
      where: { id: Number(id) },
    });

    res.json({
      success: true,
      message: "Vaccination record deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createVaccination,
  applyVaccinationTemplate,
  getVaccinations,
  updateVaccination,
  deleteVaccination,
  VACCINATION_TEMPLATES,
};
