const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");

const prisma = require("../src/lib/prisma");
const { app } = require("../src/server");

const testHouseName = "__api_test_house__";
let server;
let baseUrl;

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  const body = await response.json();

  return {
    status: response.status,
    body,
  };
};

const cleanupTestData = async () => {
  const houses = await prisma.poultryHouse.findMany({
    where: {
      name: testHouseName,
    },
    select: {
      id: true,
    },
  });

  if (houses.length > 0) {
    await prisma.poultryHouse.deleteMany({
      where: {
        id: {
          in: houses.map((house) => house.id),
        },
      },
    });
  }
};

before(async () => {
  await cleanupTestData();

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  await cleanupTestData();
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await prisma.$disconnect();
});

test("supports the poultry house and daily record lifecycle", async () => {
  const health = await request("/api/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.success, true);

  const invalidHouse = await request("/api/houses", {
    method: "POST",
    body: JSON.stringify({
      name: "Invalid House",
      birdsPlaced: 0,
      createdAt: "2026-09-10",
    }),
  });
  assert.equal(invalidHouse.status, 400);
  assert.equal(invalidHouse.body.message, "Validation failed");

  const createdHouse = await request("/api/houses", {
    method: "POST",
    body: JSON.stringify({
      name: testHouseName,
      birdsPlaced: 100,
      createdAt: "2026-09-10",
    }),
  });
  assert.equal(createdHouse.status, 201);
  const houseId = createdHouse.body.data.id;

  const houses = await request("/api/houses");
  assert.equal(houses.status, 200);
  assert.equal(
    houses.body.data.some((house) => house.id === houseId),
    true
  );

  const invalidHouseId = await request("/api/houses/not-an-id");
  assert.equal(invalidHouseId.status, 400);

  const createdRecord = await request("/api/daily-records", {
    method: "POST",
    body: JSON.stringify({
      houseId,
      date: "2026-09-10",
      mortality: 5,
      feedUsedKg: 12.5,
      eggsCollected: 40,
    }),
  });
  assert.equal(createdRecord.status, 201);
  const recordId = createdRecord.body.data.id;

  const duplicateRecord = await request("/api/daily-records", {
    method: "POST",
    body: JSON.stringify({
      houseId,
      date: "2026-09-10",
      mortality: 1,
      feedUsedKg: 5,
      eggsCollected: 20,
    }),
  });
  assert.equal(duplicateRecord.status, 409);

  const excessiveMortality = await request("/api/daily-records", {
    method: "POST",
    body: JSON.stringify({
      houseId,
      date: "2026-09-11",
      mortality: 96,
      feedUsedKg: 10,
      eggsCollected: 30,
    }),
  });
  assert.equal(excessiveMortality.status, 400);

  const updatedRecord = await request(`/api/daily-records/${recordId}`, {
    method: "PUT",
    body: JSON.stringify({
      date: "2026-09-10",
      mortality: 3,
      feedUsedKg: 13.5,
      eggsCollected: 45,
    }),
  });
  assert.equal(updatedRecord.status, 200);
  assert.equal(updatedRecord.body.data.mortality, 3);

  const dashboard = await request(`/api/houses/${houseId}/dashboard`);
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.data.statistics.currentBirds, 97);
  assert.equal(dashboard.body.data.statistics.totalFeedUsed, 13.5);

  const deletedRecord = await request(`/api/daily-records/${recordId}`, {
    method: "DELETE",
  });
  assert.equal(deletedRecord.status, 200);

  const cascadeRecord = await request("/api/daily-records", {
    method: "POST",
    body: JSON.stringify({
      houseId,
      date: "2026-09-12",
      mortality: 1,
      feedUsedKg: 2,
      eggsCollected: 3,
    }),
  });
  assert.equal(cascadeRecord.status, 201);
  const cascadeRecordId = cascadeRecord.body.data.id;

  const deletedHouse = await request(`/api/houses/${houseId}`, {
    method: "DELETE",
  });
  assert.equal(deletedHouse.status, 200);

  const missingDashboard = await request(
    `/api/houses/${houseId}/dashboard`
  );
  assert.equal(missingDashboard.status, 404);

  const missingCascadeRecord = await request(
    `/api/daily-records/${cascadeRecordId}`
  );
  assert.equal(missingCascadeRecord.status, 404);
});