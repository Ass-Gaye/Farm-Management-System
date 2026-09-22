const prisma = require("../lib/prisma");
const { computeSlaughterStatus } = require("../controllers/slaughterPlan.controller");

/**
 * Loads a house belonging to the user and aggregates production, breed, health,
 * and slaughter planning statistics.
 *
 * @param {string|number} houseId House identifier from the route
 * @param {number} userId User identifier of the authenticated requester
 * @returns {Promise<object|null>} Dashboard data or null when not found
 */
const getHouseDashboard = async (houseId, userId) => {
  const house = await prisma.poultryHouse.findFirst({
    where: {
      id: Number(houseId),
      ...(userId ? { userId } : {}),
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
      flocks: {
        include: {
          depopulationEvents: {
            select: { quantity: true },
          },
        },
      },
    },
  });

  if (!house) {
    return null;
  }

  // Daily records aggregations
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

  // Sum depopulation events across all flocks in this house
  const totalDepopulated = (house.flocks || []).reduce(
    (total, flock) =>
      total + (flock.depopulationEvents || []).reduce((sum, e) => sum + e.quantity, 0),
    0
  );

  const currentBirds = house.birdsPlaced - totalMortality - totalDepopulated;

  // Breeds aggregations
  const totalBreeds = house.breeds.length;
  const totalBreedBirds = house.breeds.reduce(
    (total, breed) => total + breed.numberOfBirds,
    0
  );

  // Health / condition summary from all records or latest
  const healthSummary = house.birdConditions.reduce(
    (acc, record) => {
      acc.healthy += record.healthy;
      acc.sick += record.sick;
      acc.weak += record.weak;
      acc.underObservation += record.underObservation;
      acc.totalRecorded +=
        record.healthy + record.sick + record.weak + record.underObservation;
      return acc;
    },
    { healthy: 0, sick: 0, weak: 0, underObservation: 0, totalRecorded: 0 }
  );

  // Slaughter planning summary
  const enrichedPlans = house.slaughterPlans.map((plan) => ({
    ...plan,
    computedStatus: computeSlaughterStatus(plan),
  }));

  const slaughterSummary = enrichedPlans.reduce(
    (acc, plan) => {
      acc.totalBirdsPlanned += plan.numberOfBirds;
      switch (plan.computedStatus) {
        case "Completed":
          acc.completed += 1;
          break;
        case "Overdue":
          acc.overdue += 1;
          break;
        case "Due today":
          acc.dueToday += 1;
          break;
        case "Due soon":
          acc.dueSoon += 1;
          break;
        case "Upcoming":
        default:
          acc.upcoming += 1;
          break;
      }
      return acc;
    },
    {
      totalBirdsPlanned: 0,
      upcoming: 0,
      dueSoon: 0,
      dueToday: 0,
      overdue: 0,
      completed: 0,
    }
  );

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
      totalBreeds,
      totalBreedBirds,
      healthSummary,
      slaughterSummary,
    },
    recentConditions: house.birdConditions.slice(0, 5),
    upcomingSlaughter: enrichedPlans.filter((p) => p.computedStatus !== "Completed").slice(0, 5),
  };
};

module.exports = {
  getHouseDashboard,
};