const prisma = require("../lib/prisma");

const createHouse = async (req, res, next) => {
  try {
    const { name, birdsPlaced, createdAt } = req.body;

    const house = await prisma.poultryHouse.create({
      data: {
        name,
        birdsPlaced,
        createdAt: new Date(createdAt),
      },


    });

    res.status(201).json({
      success: true,
      message: "Poultry house created successfully",
      data: house,
    });


  }
  catch (error) {
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

  } 
  catch (error) {
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

module.exports = {
  createHouse,
  getHouses,
  getHouseById,
};