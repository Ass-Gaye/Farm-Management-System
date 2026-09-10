const prisma = require("../lib/prisma");

const runSerializable = async (operation) => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: "Serializable",
      });
    } catch (error) {
      if (error.code !== "P2034" || attempt === 3) {
        throw error;
      }
    }
  }
};

/**
 * Creates a daily record after checking the house and available birds.
 *
 * @param {import("express").Request} req Request containing record data
 * @param {import("express").Response} res Express response
 * @param {import("express").NextFunction} next Error pipeline callback
 * @returns {Promise<void>}
 */
const createDailyRecord = async (req, res, next) => {

  try {

    const { houseId } = req.body;
    const { date, mortality, feedUsedKg, eggsCollected } = req.body;

    const dailyRecord = await runSerializable(async (transaction) => {
      const house = await transaction.poultryHouse.findUnique({
        where: {
          id: Number(houseId),
        },
        include: {
          dailyRecords: true,
        },
      });

      if (!house) {
        const error = new Error("Poultry house not found");
        error.code = "HOUSE_NOT_FOUND";
        throw error;
      }

      const totalPreviousMortality = house.dailyRecords.reduce(
        (total, record) => total + record.mortality,
        0
      );

      const currentBirds = house.birdsPlaced - totalPreviousMortality;

      if (mortality > currentBirds) {
        const error = new Error(
          `Mortality cannot exceed the current number of birds (${currentBirds})`
        );
        error.code = "MORTALITY_LIMIT";
        throw error;
      }

      return transaction.dailyRecord.create({
        data: {
          houseId: Number(houseId),
          date,
          mortality,
          feedUsedKg,
          eggsCollected,
        },
      });
    });

    res.status(201).json({
      success: true,
      message: "Daily record created successfully",
      data: dailyRecord,
    });

  } catch (error) {
    if (error.code === "HOUSE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === "MORTALITY_LIMIT") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "A daily record already exists for this house and date",
      });
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
 * Retrieves all daily records with their related house, newest first.
 *
 * @param {import("express").Request} req Express request
 * @param {import("express").Response} res Express response
 * @param {import("express").NextFunction} next Error pipeline callback
 * @returns {Promise<void>}
 */
const getDailyRecords = async (req, res, next) => {

  try {

    const records = await prisma.dailyRecord.findMany({
      include: {
        house: true,
      },
      orderBy: {
        date: "desc",
      },
    });

    res.json({
      success: true,
      data: records,
    });

  }
  catch (error) {
    next(error);
  }

};

/**
 * Retrieves one daily record and its related house.
 *
 * @param {import("express").Request} req Request containing the record ID
 * @param {import("express").Response} res Express response
 * @param {import("express").NextFunction} next Error pipeline callback
 * @returns {Promise<void>}
 */
const getDailyRecordById = async (req, res, next) => {

  try {
    const { id } = req.params;

    const record = await prisma.dailyRecord.findUnique({
      where: {
        id: Number(id),
      },
      include: {
        house: true,
      },
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Daily record not found",
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
 * Updates a record after checking mortality against the house's other records.
 *
 * @param {import("express").Request} req Request containing ID and record data
 * @param {import("express").Response} res Express response
 * @param {import("express").NextFunction} next Error pipeline callback
 * @returns {Promise<void>}
 */
const updateDailyRecord = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date, mortality, feedUsedKg, eggsCollected } = req.body;

    const updatedRecord = await runSerializable(async (transaction) => {
      const existingRecord = await transaction.dailyRecord.findUnique({
        where: {
          id: Number(id),
        },
      });

      if (!existingRecord) {
        const error = new Error("Daily record not found");
        error.code = "RECORD_NOT_FOUND";
        throw error;
      }

      const house = await transaction.poultryHouse.findUnique({
        where: {
          id: existingRecord.houseId,
        },
        include: {
          dailyRecords: true,
        },
      });

      const totalOtherMortality = house.dailyRecords
        .filter((record) => record.id !== Number(id))
        .reduce((total, record) => total + record.mortality, 0);

      const currentBirds = house.birdsPlaced - totalOtherMortality;

      if (mortality > currentBirds) {
        const error = new Error(
          `Mortality cannot exceed the available birds (${currentBirds})`
        );
        error.code = "MORTALITY_LIMIT";
        throw error;
      }

      return transaction.dailyRecord.update({
        where: {
          id: Number(id),
        },
        data: {
          date,
          mortality,
          feedUsedKg,
          eggsCollected,
        },
      });
    });

    res.json({
      success: true,
      message: "Daily record updated successfully",
      data: updatedRecord,
    });

  } catch (error) {
    if (error.code === "RECORD_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === "MORTALITY_LIMIT") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "A daily record already exists for this house and date",
      });
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
 * Deletes one daily record.
 *
 * @param {import("express").Request} req Request containing the record ID
 * @param {import("express").Response} res Express response
 * @param {import("express").NextFunction} next Error pipeline callback
 * @returns {Promise<void>}
 */
const deleteDailyRecord = async (req, res, next) => {
  try {
    const { id } = req.params;

    const record = await prisma.dailyRecord.findUnique({
      where: {
        id: Number(id),
      },
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Daily record not found",
      });
    }

    await prisma.dailyRecord.delete({
      where: {
        id: Number(id),
      },
    });

    res.json({
      success: true,
      message: "Daily record deleted successfully",
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  createDailyRecord,
  getDailyRecords,
  getDailyRecordById,
  updateDailyRecord,
  deleteDailyRecord,
};