const prisma = require("../lib/prisma");

/**
 * Creates a new breed in a poultry house owned by the authenticated user.
 */
const createBreed = async (req, res, next) => {
  try {
    const { houseId, name, description, numberOfBirds, dateAdded } = req.body;

    const house = await prisma.poultryHouse.findFirst({
      where: {
        id: Number(houseId),
        userId: req.user.id,
      },
    });

    if (!house) {
      return res.status(404).json({
        success: false,
        message: "Poultry house not found",
      });
    }

    const breed = await prisma.breed.create({
      data: {
        houseId: Number(houseId),
        name: name.trim(),
        description: description?.trim() || null,
        numberOfBirds: Number(numberOfBirds),
        dateAdded: dateAdded || new Date(),
      },
      include: {
        house: true,
      },
    });

    res.status(201).json({
      success: true,
      message: "Breed added successfully",
      data: breed,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves breeds owned by the authenticated user, optionally filtered by houseId.
 */
const getBreeds = async (req, res, next) => {
  try {
    const { houseId } = req.query;

    const whereClause = {
      house: {
        userId: req.user.id,
      },
    };

    if (houseId) {
      whereClause.houseId = Number(houseId);
    }

    const breeds = await prisma.breed.findMany({
      where: whereClause,
      include: {
        house: true,
        _count: {
          select: {
            birdConditions: true,
            slaughterPlans: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      success: true,
      data: breeds,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves a single breed by ID after verifying ownership.
 */
const getBreedById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const breed = await prisma.breed.findFirst({
      where: {
        id: Number(id),
        house: {
          userId: req.user.id,
        },
      },
      include: {
        house: true,
        birdConditions: {
          orderBy: {
            recordDate: "desc",
          },
        },
        slaughterPlans: {
          orderBy: {
            expectedSlaughterDate: "asc",
          },
        },
      },
    });

    if (!breed) {
      return res.status(404).json({
        success: false,
        message: "Breed not found",
      });
    }

    res.json({
      success: true,
      data: breed,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates a breed owned by the authenticated user.
 */
const updateBreed = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, numberOfBirds, dateAdded } = req.body;

    const existingBreed = await prisma.breed.findFirst({
      where: {
        id: Number(id),
        house: {
          userId: req.user.id,
        },
      },
    });

    if (!existingBreed) {
      return res.status(404).json({
        success: false,
        message: "Breed not found",
      });
    }

    const breed = await prisma.breed.update({
      where: {
        id: Number(id),
      },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        numberOfBirds: Number(numberOfBirds),
        ...(dateAdded ? { dateAdded } : {}),
      },
      include: {
        house: true,
      },
    });

    res.json({
      success: true,
      message: "Breed updated successfully",
      data: breed,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deletes a breed owned by the authenticated user.
 */
const deleteBreed = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existingBreed = await prisma.breed.findFirst({
      where: {
        id: Number(id),
        house: {
          userId: req.user.id,
        },
      },
    });

    if (!existingBreed) {
      return res.status(404).json({
        success: false,
        message: "Breed not found",
      });
    }

    await prisma.breed.delete({
      where: {
        id: Number(id),
      },
    });

    res.json({
      success: true,
      message: "Breed deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBreed,
  getBreeds,
  getBreedById,
  updateBreed,
  deleteBreed,
};
