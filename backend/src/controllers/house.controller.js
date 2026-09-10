const prisma = require("../lib/prisma");

const createHouse = async (req, res, next) => {
  try {
    const { name, birdsPlaced, createdAt } = req.body;

    const house = await prisma.poultryHouse.create({
      data: {
        name,
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

const getHouses = async (req, res, next) => {
  try {
    const houses = await prisma.poultryHouse.findMany({
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

const getHouseById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const house = await prisma.poultryHouse.findUnique({
      where: {
        id: Number(id),
      },

      include: {
        dailyRecords: {
          orderBy: {
            date: "desc",
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

const updateHouse = async (req, res, next) => {

  try {

    const { id } = req.params;
    const { name, birdsPlaced, createdAt } = req.body;

    const existingHouse = await prisma.poultryHouse.findUnique({
      where: {
        id: Number(id),
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


    const totalMortality = existingHouse.dailyRecords.reduce(
      (total, record) => total + record.mortality,
      0
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

const deleteHouse = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existingHouse = await prisma.poultryHouse.findUnique({
      where: {
        id: Number(id),
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