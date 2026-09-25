const prisma = require("../lib/prisma");
const {
  getAdjustmentMaps,
  sumCorrectedMortality,
} = require("../services/correction.service");

/**
 * Creates a poultry house associated with the authenticated user.
 *
 * @param {import("express").Request} req Request containing house fields and req.user
 * @param {import("express").Response} res Express response
 * @param {import("express").NextFunction} next Error pipeline callback
 * @returns {Promise<void>}
 */
const createHouse = async (req, res, next) => {
  try {
    const { name, address, birdsPlaced, createdAt } = req.body;

    const house = await prisma.poultryHouse.create({
      data: {
        userId: req.user.id,
        name,
        address,
        birdsPlaced,
        createdAt,
      },
    });

    res.status(201).json({
      success: true,
      message: "Poultry house created successfully",
      data: house,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves all poultry houses belonging to the authenticated user.
 *
 * @param {import("express").Request} req Express request
 * @param {import("express").Response} res Express response
 * @param {import("express").NextFunction} next Error pipeline callback
 * @returns {Promise<void>}
 */
const getHouses = async (req, res, next) => {
  try {
    const houses = await prisma.poultryHouse.findMany({
      where: {
        userId: req.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      success: true,
      data: houses,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves one poultry house and its relations, verifying ownership.
 *
 * @param {import("express").Request} req Request containing house ID
 * @param {import("express").Response} res Express response
 * @param {import("express").NextFunction} next Error pipeline callback
 * @returns {Promise<void>}
 */
const getHouseById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const house = await prisma.poultryHouse.findFirst({
      where: {
        id: Number(id),
        userId: req.user.id,
      },
      include: {
        dailyRecords: {
          orderBy: {
            date: "desc",
          },
        },
        breeds: {
          orderBy: {
            createdAt: "desc",
          },
        },
        birdConditions: {
          include: {
            breed: true,
          },
          orderBy: {
            recordDate: "desc",
          },
        },
        slaughterPlans: {
          include: {
            breed: true,
          },
          orderBy: {
            expectedSlaughterDate: "asc",
          },
        },
      },
    });

    if (!house) {
      return res.status(404).json({
        success: false,
        message: "Poultry house not found",
      });
    }

    res.json({
      success: true,
      data: house,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates a poultry house while preventing its bird count from dropping
 * below accumulated mortality, strictly enforcing user ownership.
 *
 * @param {import("express").Request} req Request containing ID and house data
 * @param {import("express").Response} res Express response
 * @param {import("express").NextFunction} next Error pipeline callback
 * @returns {Promise<void>}
 */
const updateHouse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, address, birdsPlaced, createdAt } = req.body;

    const existingHouse = await prisma.poultryHouse.findFirst({
      where: {
        id: Number(id),
        userId: req.user.id,
      },
      include: {
        dailyRecords: true,
      },
    });

    if (!existingHouse) {
      return res.status(404).json({
        success: false,
        message: "Poultry house not found",
      });
    }

    const totalMortality = sumCorrectedMortality(
      existingHouse.dailyRecords,
      await getAdjustmentMaps(
        prisma,
        existingHouse.dailyRecords.map((r) => r.id),
        req.user.id
      )
    );

    if (birdsPlaced < totalMortality) {
      return res.status(400).json({
        success: false,
        message: `Birds placed cannot be less than total mortality (${totalMortality})`,
      });
    }

    const house = await prisma.poultryHouse.update({
      where: {
        id: Number(id),
      },
      data: {
        name,
        address,
        birdsPlaced,
        createdAt,
      },
    });

    res.json({
      success: true,
      message: "Poultry house updated successfully",
      data: house,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deletes a poultry house belonging to the authenticated user.
 * The database relation cascades daily records, breeds, conditions, and slaughter plans.
 *
 * @param {import("express").Request} req Request containing the house ID
 * @param {import("express").Response} res Express response
 * @param {import("express").NextFunction} next Error pipeline callback
 * @returns {Promise<void>}
 */
const deleteHouse = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existingHouse = await prisma.poultryHouse.findFirst({
      where: {
        id: Number(id),
        userId: req.user.id,
      },
    });

    if (!existingHouse) {
      return res.status(404).json({
        success: false,
        message: "Poultry house not found",
      });
    }

    await prisma.poultryHouse.delete({
      where: {
        id: Number(id),
      },
    });

    res.json({
      success: true,
      message: "Poultry house deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createHouse,
  getHouses,
  getHouseById,
  updateHouse,
  deleteHouse,
};