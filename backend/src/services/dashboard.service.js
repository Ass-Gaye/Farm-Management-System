const prisma = require("../lib/prisma");

/**
 * Loads a house and aggregates its daily production statistics.
 *
 * currentBirds is derived from the initial bird count minus total mortality.
 * Returning null for a missing house lets the controller choose the HTTP 404.
 *
 * @param {string|number} houseId House identifier from the route
 * @returns {Promise<object|null>} Dashboard data or null when not found
 */
const getHouseDashboard = async (houseId) => {
  const house = await prisma.poultryHouse.findUnique({
    where: {
      id: Number(houseId),
    },

    include: {
      dailyRecords: true,
    },

  });


  if (!house) {
    return null;
  }



  const totalMortality = house.dailyRecords.reduce(
    (total, record) => total + record.mortality,
    0
  );


  const totalFeedUsed = house.dailyRecords.reduce(
    (total, record) => total + record.feedUsedKg,
    0
  );

  const totalEggsCollected = house.dailyRecords.reduce(
    (total, record) => total + record.eggsCollected,
    0
  );

  const currentBirds = house.birdsPlaced - totalMortality;


  return {
    house: {
      id: house.id,
      name: house.name,
      birdsPlaced: house.birdsPlaced,
      createdAt: house.createdAt,
    },
    statistics: {
      currentBirds,
      totalMortality,
      totalFeedUsed,
      totalEggsCollected,
    },
  };


};

module.exports = {
  getHouseDashboard,
};


// an expalanation of the code is that it defines a function `getHouseDashboard`
// that retrieves information about a specific poultry house
//  from a database using Prisma. It calculates various statistics such as total mortality,
//  total feed used, total eggs collected, and the current number of birds in the house.
//  The function returns an object containing the house details and the calculated statistics.
//  If the house is not found, it returns null. The function is then exported for use in other parts of the application.