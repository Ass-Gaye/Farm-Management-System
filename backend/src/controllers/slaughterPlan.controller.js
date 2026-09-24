const prisma = require("../lib/prisma");
const { computeSlaughterStatus } = require("../services/slaughter.service");

/**
 * Validates dates and bird count limits for slaughter planning.
 */
const validateSlaughterPlan = async ({
  houseId,
  breedId,
  numberOfBirds,
  placementDate,
  expectedSlaughterDate,
  userId,
}) => {
  const pDate = new Date(placementDate);
  const sDate = new Date(expectedSlaughterDate);

  if (sDate < pDate) {
    const error = new Error(
      "Expected slaughter date cannot be earlier than placement date"
    );
    error.statusCode = 400;
    throw error;
  }

  const house = await prisma.poultryHouse.findFirst({
    where: {
      id: Number(houseId),
      userId,
    },
    include: {
      dailyRecords: true,
      flocks: {
        include: {
          depopulationEvents: { select: { quantity: true } },
        },
      },
    },
  });

  if (!house) {
    const error = new Error("Poultry house not found");
    error.statusCode = 404;
    throw error;
  }

  const totalMortality = house.dailyRecords.reduce(
    (sum, record) => sum + record.mortality,
    0
  );
  const totalDepopulated = (house.flocks || []).reduce(
    (total, flock) =>
      total + (flock.depopulationEvents || []).reduce((sum, e) => sum + e.quantity, 0),
    0
  );
  const currentBirdsInHouse = Math.max(0, house.birdsPlaced - totalMortality - totalDepopulated);

  if (breedId) {
    const breed = await prisma.breed.findFirst({
      where: {
        id: Number(breedId),
        houseId: Number(houseId),
        house: {
          userId,
        },
      },
    });

    if (!breed) {
      const error = new Error("Selected breed not found in this poultry house");
      error.statusCode = 404;
      throw error;
    }

    if (numberOfBirds > breed.numberOfBirds) {
      const error = new Error(
        `Slaughter bird count (${numberOfBirds}) cannot exceed birds available for breed "${breed.name}" (${breed.numberOfBirds})`
      );
      error.statusCode = 400;
      throw error;
    }
  } else {
    if (numberOfBirds > currentBirdsInHouse) {
      const error = new Error(
        `Slaughter bird count (${numberOfBirds}) cannot exceed available birds in the house (${currentBirdsInHouse})`
      );
      error.statusCode = 400;
      throw error;
    }
  }

  return { house, currentBirdsInHouse };
};

/**
 * Creates a new slaughter plan.
 */
const createSlaughterPlan = async (req, res, next) => {
  try {
    const {
      houseId,
      breedId,
      numberOfBirds,
      placementDate,
      expectedSlaughterDate,
      status = "Upcoming",
      notes,
    } = req.body;

    await validateSlaughterPlan({
      houseId,
      breedId,
      numberOfBirds,
      placementDate,
      expectedSlaughterDate,
      userId: req.user.id,
    });

    const plan = await prisma.slaughterPlan.create({
      data: {
        houseId: Number(houseId),
        breedId: breedId ? Number(breedId) : null,
        numberOfBirds: Number(numberOfBirds),
        placementDate: new Date(placementDate),
        expectedSlaughterDate: new Date(expectedSlaughterDate),
        status: status.trim(),
        notes: notes?.trim() || null,
      },
      include: {
        house: true,
        breed: true,
      },
    });

    res.status(201).json({
      success: true,
      message: "Slaughter plan created successfully",
      data: {
        ...plan,
        computedStatus: computeSlaughterStatus(plan),
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * Retrieves slaughter plans owned by the authenticated user.
 */
const getSlaughterPlans = async (req, res, next) => {
  try {
    const { houseId, breedId, status } = req.query;

    const whereClause = {
      house: {
        userId: req.user.id,
      },
    };

    if (houseId) {
      whereClause.houseId = Number(houseId);
    }

    if (breedId) {
      whereClause.breedId = Number(breedId);
    }

    if (status) {
      whereClause.status = status;
    }

    const plans = await prisma.slaughterPlan.findMany({
      where: whereClause,
      include: {
        house: true,
        breed: true,
      },
      orderBy: {
        expectedSlaughterDate: "asc",
      },
    });

    const enriched = plans.map((plan) => ({
      ...plan,
      computedStatus: computeSlaughterStatus(plan),
    }));

    res.json({
      success: true,
      data: enriched,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves a single slaughter plan by ID.
 */
const getSlaughterPlanById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const plan = await prisma.slaughterPlan.findFirst({
      where: {
        id: Number(id),
        house: {
          userId: req.user.id,
        },
      },
      include: {
        house: true,
        breed: true,
      },
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Slaughter plan not found",
      });
    }

    res.json({
      success: true,
      data: {
        ...plan,
        computedStatus: computeSlaughterStatus(plan),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates a slaughter plan.
 */
const updateSlaughterPlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      breedId,
      numberOfBirds,
      placementDate,
      expectedSlaughterDate,
      status,
      notes,
    } = req.body;

    const existingPlan = await prisma.slaughterPlan.findFirst({
      where: {
        id: Number(id),
        house: {
          userId: req.user.id,
        },
      },
    });

    if (!existingPlan) {
      return res.status(404).json({
        success: false,
        message: "Slaughter plan not found",
      });
    }

    const targetBreedId =
      breedId !== undefined
        ? breedId
          ? Number(breedId)
          : null
        : existingPlan.breedId;
    const targetBirds =
      numberOfBirds !== undefined
        ? Number(numberOfBirds)
        : existingPlan.numberOfBirds;
    const targetPlacementDate = placementDate || existingPlan.placementDate;
    const targetExpectedDate =
      expectedSlaughterDate || existingPlan.expectedSlaughterDate;

    await validateSlaughterPlan({
      houseId: existingPlan.houseId,
      breedId: targetBreedId,
      numberOfBirds: targetBirds,
      placementDate: targetPlacementDate,
      expectedSlaughterDate: targetExpectedDate,
      userId: req.user.id,
    });

    const updated = await prisma.slaughterPlan.update({
      where: {
        id: Number(id),
      },
      data: {
        breedId: targetBreedId,
        numberOfBirds: targetBirds,
        placementDate: new Date(targetPlacementDate),
        expectedSlaughterDate: new Date(targetExpectedDate),
        status: status !== undefined ? status.trim() : existingPlan.status,
        notes: notes !== undefined ? (notes?.trim() || null) : existingPlan.notes,
      },
      include: {
        house: true,
        breed: true,
      },
    });

    res.json({
      success: true,
      message: "Slaughter plan updated successfully",
      data: {
        ...updated,
        computedStatus: computeSlaughterStatus(updated),
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * Toggles or marks a slaughter plan completed.
 */
const toggleSlaughterPlanComplete = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { completed } = req.body;

    const existingPlan = await prisma.slaughterPlan.findFirst({
      where: {
        id: Number(id),
        house: {
          userId: req.user.id,
        },
      },
    });

    if (!existingPlan) {
      return res.status(404).json({
        success: false,
        message: "Slaughter plan not found",
      });
    }

    const newStatus =
      completed === undefined
        ? existingPlan.status === "Completed"
          ? "Upcoming"
          : "Completed"
        : completed
        ? "Completed"
        : "Upcoming";

    const updated = await prisma.slaughterPlan.update({
      where: {
        id: Number(id),
      },
      data: {
        status: newStatus,
      },
      include: {
        house: true,
        breed: true,
      },
    });

    // Slaughter depopulation event integration
    let targetFlockId = existingPlan.flockId;
    if (!targetFlockId) {
      const activeFlock = await prisma.flock.findFirst({
        where: { houseId: existingPlan.houseId, userId: req.user.id, status: "ACTIVE" },
      });
      if (activeFlock) {
        targetFlockId = activeFlock.id;
      }
    }

    if (targetFlockId) {
      const { calculateLiveBirds } = require("./depopulation.controller");
      if (newStatus === "Completed") {
        const existingEvent = await prisma.depopulationEvent.findFirst({
          where: {
            userId: req.user.id,
            flockId: targetFlockId,
            reason: "SLAUGHTERED",
            notes: `Slaughter plan #${existingPlan.id} completed`,
          },
        });

        if (!existingEvent) {
          const birdStats = await calculateLiveBirds(targetFlockId);
          const qtyToDepopulate = Math.min(existingPlan.numberOfBirds, birdStats?.liveBirds || 0);

          if (qtyToDepopulate > 0) {
            await prisma.depopulationEvent.create({
              data: {
                userId: req.user.id,
                flockId: targetFlockId,
                quantity: qtyToDepopulate,
                reason: "SLAUGHTERED",
                date: new Date(),
                notes: `Slaughter plan #${existingPlan.id} completed`,
              },
            });

            const updatedStats = await calculateLiveBirds(targetFlockId);
            await prisma.flock.update({
              where: { id: targetFlockId },
              data: { currentBirds: updatedStats.liveBirds },
            });
          }
        }
      } else {
        // Toggled back from completed - remove completion event
        const deleted = await prisma.depopulationEvent.deleteMany({
          where: {
            userId: req.user.id,
            flockId: targetFlockId,
            reason: "SLAUGHTERED",
            notes: `Slaughter plan #${existingPlan.id} completed`,
          },
        });

        if (deleted.count > 0) {
          const updatedStats = await calculateLiveBirds(targetFlockId);
          await prisma.flock.update({
            where: { id: targetFlockId },
            data: { currentBirds: updatedStats.liveBirds },
          });
        }
      }
    }

    res.json({
      success: true,
      message: `Slaughter plan marked as ${newStatus}`,
      data: {
        ...updated,
        computedStatus: computeSlaughterStatus(updated),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deletes a slaughter plan.
 */
const deleteSlaughterPlan = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existingPlan = await prisma.slaughterPlan.findFirst({
      where: {
        id: Number(id),
        house: {
          userId: req.user.id,
        },
      },
    });

    if (!existingPlan) {
      return res.status(404).json({
        success: false,
        message: "Slaughter plan not found",
      });
    }

    await prisma.slaughterPlan.delete({
      where: {
        id: Number(id),
      },
    });

    res.json({
      success: true,
      message: "Slaughter plan deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSlaughterPlan,
  getSlaughterPlans,
  getSlaughterPlanById,
  updateSlaughterPlan,
  toggleSlaughterPlanComplete,
  deleteSlaughterPlan,
  computeSlaughterStatus,
};
