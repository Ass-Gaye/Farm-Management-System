const prisma = require("../lib/prisma");

/**
 * Validates bird condition counts against the available birds in the breed or house.
 */
const validateBirdConditionLimits = async ({ houseId, breedId, totalConditionBirds, userId }) => {
  const house = await prisma.poultryHouse.findFirst({
    where: {
      id: Number(houseId),
      userId,
    },
    include: {
      dailyRecords: true,
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
  const currentBirdsInHouse = house.birdsPlaced - totalMortality;

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

    if (totalConditionBirds > breed.numberOfBirds) {
      const error = new Error(
        `Total condition birds (${totalConditionBirds}) exceeds available birds for breed "${breed.name}" (${breed.numberOfBirds})`
      );
      error.statusCode = 400;
      throw error;
    }
  } else {
    if (totalConditionBirds > currentBirdsInHouse) {
      const error = new Error(
        `Total condition birds (${totalConditionBirds}) exceeds available birds in the house (${currentBirdsInHouse})`
      );
      error.statusCode = 400;
      throw error;
    }
  }

  return { house, currentBirdsInHouse };
};

/**
 * Creates a bird health and condition record.
 */
const createBirdCondition = async (req, res, next) => {
  try {
    const {
      houseId,
      breedId,
      healthy = 0,
      sick = 0,
      weak = 0,
      underObservation = 0,
      notes,
      recordDate,
    } = req.body;

    const totalConditionBirds =
      Number(healthy) + Number(sick) + Number(weak) + Number(underObservation);

    await validateBirdConditionLimits({
      houseId,
      breedId,
      totalConditionBirds,
      userId: req.user.id,
    });

    const record = await prisma.birdCondition.create({
      data: {
        houseId: Number(houseId),
        breedId: breedId ? Number(breedId) : null,
        healthy: Number(healthy),
        sick: Number(sick),
        weak: Number(weak),
        underObservation: Number(underObservation),
        notes: notes?.trim() || null,
        recordDate: recordDate || new Date(),
      },
      include: {
        house: true,
        breed: true,
      },
    });

    res.status(201).json({
      success: true,
      message: "Bird condition record created successfully",
      data: record,
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
 * Retrieves bird condition records owned by the authenticated user.
 */
const getBirdConditions = async (req, res, next) => {
  try {
    const { houseId, breedId } = req.query;

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

    const records = await prisma.birdCondition.findMany({
      where: whereClause,
      include: {
        house: true,
        breed: true,
      },
      orderBy: {
        recordDate: "desc",
      },
    });

    res.json({
      success: true,
      data: records,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves a single bird condition record by ID.
 */
const getBirdConditionById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const record = await prisma.birdCondition.findFirst({
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

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Bird condition record not found",
      });
    }

    res.json({
      success: true,
      data: record,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates a bird condition record after verifying limits.
 */
const updateBirdCondition = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      breedId,
      healthy = 0,
      sick = 0,
      weak = 0,
      underObservation = 0,
      notes,
      recordDate,
    } = req.body;

    const existingRecord = await prisma.birdCondition.findFirst({
      where: {
        id: Number(id),
        house: {
          userId: req.user.id,
        },
      },
    });

    if (!existingRecord) {
      return res.status(404).json({
        success: false,
        message: "Bird condition record not found",
      });
    }

    const targetBreedId = breedId !== undefined ? (breedId ? Number(breedId) : null) : existingRecord.breedId;
    const totalConditionBirds =
      Number(healthy) + Number(sick) + Number(weak) + Number(underObservation);

    await validateBirdConditionLimits({
      houseId: existingRecord.houseId,
      breedId: targetBreedId,
      totalConditionBirds,
      userId: req.user.id,
    });

    const updated = await prisma.birdCondition.update({
      where: {
        id: Number(id),
      },
      data: {
        breedId: targetBreedId,
        healthy: Number(healthy),
        sick: Number(sick),
        weak: Number(weak),
        underObservation: Number(underObservation),
        notes: notes !== undefined ? (notes?.trim() || null) : existingRecord.notes,
        ...(recordDate ? { recordDate } : {}),
      },
      include: {
        house: true,
        breed: true,
      },
    });

    res.json({
      success: true,
      message: "Bird condition record updated successfully",
      data: updated,
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
 * Deletes a bird condition record.
 */
const deleteBirdCondition = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existingRecord = await prisma.birdCondition.findFirst({
      where: {
        id: Number(id),
        house: {
          userId: req.user.id,
        },
      },
    });

    if (!existingRecord) {
      return res.status(404).json({
        success: false,
        message: "Bird condition record not found",
      });
    }

    await prisma.birdCondition.delete({
      where: {
        id: Number(id),
      },
    });

    res.json({
      success: true,
      message: "Bird condition record deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBirdCondition,
  getBirdConditions,
  getBirdConditionById,
  updateBirdCondition,
  deleteBirdCondition,
};
