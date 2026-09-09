const prisma = require("../lib/prisma");

const createDailyRecord = async (req, res, next) => {

  try {
    const { houseId } = req.params;
    const { date, mortality, feedUsedKg, eggsCollected } = req.body;

    const house = await prisma.poultryHouse.findUnique({
      where: {
        id: Number(houseId),
      },

    });


    if (!house) {
      return res.status(404).json({
        success: false,
        message: "Poultry house not found",
      });
    }


    const dailyRecord = await prisma.dailyRecord.create({
      data: {
        houseId: Number(houseId),
        date: new Date(date),
        mortality,
        feedUsedKg,
        eggsCollected,
      },

    });

    res.status(201).json({
      success: true,
      message: "Daily record created successfully",
      data: dailyRecord,
    });

  }
  catch (error) {
    next(error);
  }

};

const getDailyRecords = async (req, res, next) => {

  try {

    const { houseId } = req.params;


    const house = await prisma.poultryHouse.findUnique({
      where: {
        id: Number(houseId),
      },
    });


    if (!house) {
      return res.status(404).json({
        success: false,
        message: "Poultry house not found",
      });
    }


    const records = await prisma.dailyRecord.findMany({
      where: {
        houseId: Number(houseId),
      },

      orderBy: {
        date: "desc",
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

module.exports = {
  createDailyRecord,
  getDailyRecords,
};