const prisma = require("../lib/prisma");

const createDailyRecord = async (req, res, next) => {

 try {

    const { houseId } = req.body;
    const { date, mortality, feedUsedKg, eggsCollected } = req.body;

    const house = await prisma.poultryHouse.findUnique({
      where: {
        id: Number(houseId),
      },
      include: {
        dailyRecords: true,
      },
    });

    if (!house) {
      return res.status(404).json({
        success: false,
        message: "Poultry house not found",
      });
    }

    const totalPreviousMortality = house.dailyRecords.reduce(
      (total, record) => total + record.mortality,
      0
    );

    const currentBirds = house.birdsPlaced - totalPreviousMortality;

    if (mortality > currentBirds) {
      return res.status(400).json({
        success: false,
        message: `Mortality cannot exceed the current number of birds (${currentBirds})`,
      });
    }

    const dailyRecord = await prisma.dailyRecord.create({
      data: {
        houseId: Number(houseId),
        date,
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
        if (error.code === "P2002") {
            return res.status(409).json({
            success: false,
            message: "A daily record already exists for this house and date",
            });
        }

    next(error);
    }

};

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

const updateDailyRecord = async (req, res, next) => {

  try {

    const { id } = req.params;
    const {
      date,
      mortality,
      feedUsedKg,
      eggsCollected,
    } = req.body;

    const existingRecord = await prisma.dailyRecord.findUnique({
      where: {
        id: Number(id),
      },
    });

    if (!existingRecord) {
      return res.status(404).json({
        success: false,
        message: "Daily record not found",
      });
    }

    const house = await prisma.poultryHouse.findUnique({
      where: {
        id: existingRecord.houseId,
      },

      include: {
        dailyRecords: true,
      },

    });

    const totalOtherMortality = house.dailyRecords
      .filter((record) => record.id !== Number(id))
      .reduce(
        (total, record) => total + record.mortality,
        0
      );

    const currentBirds =
      house.birdsPlaced - totalOtherMortality;

    if (mortality > currentBirds) {
      return res.status(400).json({
        success: false,
        message: `Mortality cannot exceed the available birds (${currentBirds})`,
      });
    }

    const updatedRecord = await prisma.dailyRecord.update({
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

    res.json({
      success: true,
      message: "Daily record updated successfully",
      data: updatedRecord,
    });

    } catch (error) {
        if (error.code === "P2002") {
            return res.status(409).json({
            success: false,
            message: "A daily record already exists for this house and date",
            });
        }

     next(error);
    }

};

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