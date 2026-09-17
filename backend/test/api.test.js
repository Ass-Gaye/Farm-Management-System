const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");

const prisma = require("../src/lib/prisma");
const { app } = require("../src/server");

const testUser1Email = "test_user1@example.com";
const testUser2Email = "test_user2@example.com";
const testHouseName = "__api_test_house__";
let server;
let baseUrl;

const request = async (path, options = {}) => {
  const { headers, ...restOptions } = options;
  const response = await fetch(`${baseUrl}${path}`, {
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });

  const body = await response.json();

  return {
    status: response.status,
    body,
  };
};

const cleanupTestData = async () => {
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [testUser1Email, testUser2Email],
      },
    },
  });

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

test("supports full authentication, user isolation, and features lifecycle", async () => {
  // 1. Health check
  const health = await request("/api/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.success, true);

  // 2. Unauthenticated access rejected
  const unauthHouses = await request("/api/houses");
  assert.equal(unauthHouses.status, 401);

  // 3. User 1 Registration & Login
  const regUser1 = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: testUser1Email,
      password: "password123",
      name: "Farmer Alice",
    }),
  });
  assert.equal(regUser1.status, 201);
  assert.ok(regUser1.body.data.token);
  assert.equal(regUser1.body.data.user.email, testUser1Email);
  const token1 = regUser1.body.data.token;
  const authHeaders1 = { Authorization: `Bearer ${token1}` };

  // Check /me
  const me = await request("/api/auth/me", { headers: authHeaders1 });
  assert.equal(me.status, 200);
  assert.equal(me.body.data.email, testUser1Email);

  // 4. User 2 Registration
  const regUser2 = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: testUser2Email,
      password: "password456",
      name: "Farmer Bob",
    }),
  });
  assert.equal(regUser2.status, 201);
  const token2 = regUser2.body.data.token;
  const authHeaders2 = { Authorization: `Bearer ${token2}` };

  // 5. User 1 House Management
  const invalidHouse = await request("/api/houses", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      name: "Invalid House",
      birdsPlaced: 0,
      createdAt: "2026-09-10",
    }),
  });
  assert.equal(invalidHouse.status, 400);

  const createdHouse = await request("/api/houses", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      name: testHouseName,
      birdsPlaced: 100,
      createdAt: "2026-09-10",
    }),
  });
  assert.equal(createdHouse.status, 201);
  const houseId = createdHouse.body.data.id;

  // Verify User 1 sees the house
  const user1Houses = await request("/api/houses", { headers: authHeaders1 });
  assert.equal(user1Houses.status, 200);
  assert.equal(user1Houses.body.data.some((h) => h.id === houseId), true);

  // Verify User 2 DOES NOT see User 1's house
  const user2Houses = await request("/api/houses", { headers: authHeaders2 });
  assert.equal(user2Houses.status, 200);
  assert.equal(user2Houses.body.data.some((h) => h.id === houseId), false);

  // Verify User 2 cannot access, edit, or delete User 1's house
  const user2GetHouse = await request(`/api/houses/${houseId}`, { headers: authHeaders2 });
  assert.equal(user2GetHouse.status, 404);

  const user2UpdateHouse = await request(`/api/houses/${houseId}`, {
    method: "PUT",
    headers: authHeaders2,
    body: JSON.stringify({
      name: "Hacked House",
      birdsPlaced: 200,
      createdAt: "2026-09-10",
    }),
  });
  assert.equal(user2UpdateHouse.status, 404);

  const user2DeleteHouse = await request(`/api/houses/${houseId}`, {
    method: "DELETE",
    headers: authHeaders2,
  });
  assert.equal(user2DeleteHouse.status, 404);

  // 6. Daily Records Lifecycle & Validation
  const createdRecord = await request("/api/daily-records", {
    method: "POST",
    headers: authHeaders1,
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

  // Duplicate date rejected
  const duplicateRecord = await request("/api/daily-records", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      houseId,
      date: "2026-09-10",
      mortality: 1,
      feedUsedKg: 5,
      eggsCollected: 20,
    }),
  });
  assert.equal(duplicateRecord.status, 409);

  // Excessive mortality rejected
  const excessiveMortality = await request("/api/daily-records", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      houseId,
      date: "2026-09-11",
      mortality: 96,
      feedUsedKg: 10,
      eggsCollected: 30,
    }),
  });
  assert.equal(excessiveMortality.status, 400);

  // User 2 cannot create record in User 1's house
  const user2CreateRecord = await request("/api/daily-records", {
    method: "POST",
    headers: authHeaders2,
    body: JSON.stringify({
      houseId,
      date: "2026-09-12",
      mortality: 1,
      feedUsedKg: 5,
      eggsCollected: 10,
    }),
  });
  assert.equal(user2CreateRecord.status, 404);

  // Update record
  const updatedRecord = await request(`/api/daily-records/${recordId}`, {
    method: "PUT",
    headers: authHeaders1,
    body: JSON.stringify({
      date: "2026-09-10",
      mortality: 3,
      feedUsedKg: 13.5,
      eggsCollected: 45,
    }),
  });
  assert.equal(updatedRecord.status, 200);
  assert.equal(updatedRecord.body.data.mortality, 3);

  // 7. Breed Management
  // Invalid breed (missing name)
  const invalidBreed = await request("/api/breeds", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      houseId,
      name: "",
      numberOfBirds: 50,
    }),
  });
  assert.equal(invalidBreed.status, 400);

  // Valid breed
  const createdBreed = await request("/api/breeds", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      houseId,
      name: "Broiler Cobb 500",
      description: "Fast-growing meat bird",
      numberOfBirds: 50,
      dateAdded: "2026-09-10",
    }),
  });
  assert.equal(createdBreed.status, 201);
  const breedId = createdBreed.body.data.id;
  assert.equal(createdBreed.body.data.name, "Broiler Cobb 500");

  // User 2 cannot view or edit User 1's breed
  const user2GetBreed = await request(`/api/breeds/${breedId}`, { headers: authHeaders2 });
  assert.equal(user2GetBreed.status, 404);

  // Update breed
  const updatedBreed = await request(`/api/breeds/${breedId}`, {
    method: "PUT",
    headers: authHeaders1,
    body: JSON.stringify({
      name: "Broiler Cobb 500 Plus",
      description: "Updated description",
      numberOfBirds: 55,
    }),
  });
  assert.equal(updatedBreed.status, 200);
  assert.equal(updatedBreed.body.data.name, "Broiler Cobb 500 Plus");

  // 8. Bird Condition & Health Tracking
  // Excessive birds in condition record (> breed.numberOfBirds = 55)
  const excessiveCondition = await request("/api/bird-conditions", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      houseId,
      breedId,
      healthy: 50,
      sick: 10, // 50 + 10 = 60 > 55
      weak: 0,
      underObservation: 0,
      recordDate: "2026-09-12",
    }),
  });
  assert.equal(excessiveCondition.status, 400);

  // Valid condition record
  const createdCondition = await request("/api/bird-conditions", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      houseId,
      breedId,
      healthy: 48,
      sick: 2,
      weak: 1,
      underObservation: 1,
      notes: "Flock is active, 2 birds isolated for mild sneezing",
      recordDate: "2026-09-12",
    }),
  });
  assert.equal(createdCondition.status, 201);
  const conditionId = createdCondition.body.data.id;
  assert.equal(createdCondition.body.data.healthy, 48);

  // User 2 cannot access condition record
  const user2GetCondition = await request(`/api/bird-conditions/${conditionId}`, {
    headers: authHeaders2,
  });
  assert.equal(user2GetCondition.status, 404);

  // 9. Expected Slaughter Date Planning
  // Slaughter date earlier than placement date rejected
  const invalidSlaughterDate = await request("/api/slaughter-plans", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      houseId,
      breedId,
      numberOfBirds: 20,
      placementDate: "2026-09-10",
      expectedSlaughterDate: "2026-09-05", // Earlier!
    }),
  });
  assert.equal(invalidSlaughterDate.status, 400);

  // Valid slaughter plan (Upcoming)
  const createdSlaughterPlan = await request("/api/slaughter-plans", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      houseId,
      breedId,
      numberOfBirds: 30,
      placementDate: "2026-09-10",
      expectedSlaughterDate: "2026-10-25",
      notes: "Batch ready for local market",
    }),
  });
  assert.equal(createdSlaughterPlan.status, 201);
  const planId = createdSlaughterPlan.body.data.id;
  assert.equal(createdSlaughterPlan.body.data.computedStatus, "Upcoming");

  // Toggle slaughter completed
  const completedPlan = await request(`/api/slaughter-plans/${planId}/complete`, {
    method: "PATCH",
    headers: authHeaders1,
    body: JSON.stringify({ completed: true }),
  });
  assert.equal(completedPlan.status, 200);
  assert.equal(completedPlan.body.data.status, "Completed");
  assert.equal(completedPlan.body.data.computedStatus, "Completed");

  // 10. Dashboard Aggregation
  const dashboard = await request(`/api/houses/${houseId}/dashboard`, {
    headers: authHeaders1,
  });
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.data.statistics.currentBirds, 97); // 100 - 3
  assert.equal(dashboard.body.data.statistics.totalBreeds, 1);
  assert.equal(dashboard.body.data.statistics.healthSummary.healthy, 48);
  assert.equal(dashboard.body.data.statistics.healthSummary.sick, 2);

  // User 2 cannot access User 1's dashboard
  const user2Dashboard = await request(`/api/houses/${houseId}/dashboard`, {
    headers: authHeaders2,
  });
  assert.equal(user2Dashboard.status, 404);

  // 11. Cleanup and Deletion
  const deletePlan = await request(`/api/slaughter-plans/${planId}`, {
    method: "DELETE",
    headers: authHeaders1,
  });
  assert.equal(deletePlan.status, 200);

  const deleteCondition = await request(`/api/bird-conditions/${conditionId}`, {
    method: "DELETE",
    headers: authHeaders1,
  });
  assert.equal(deleteCondition.status, 200);

  const deleteBreedRes = await request(`/api/breeds/${breedId}`, {
    method: "DELETE",
    headers: authHeaders1,
  });
  assert.equal(deleteBreedRes.status, 200);

  const deleteRecordRes = await request(`/api/daily-records/${recordId}`, {
    method: "DELETE",
    headers: authHeaders1,
  });
  assert.equal(deleteRecordRes.status, 200);

  const deleteHouseRes = await request(`/api/houses/${houseId}`, {
    method: "DELETE",
    headers: authHeaders1,
  });
  assert.equal(deleteHouseRes.status, 200);

  const missingHouse = await request(`/api/houses/${houseId}`, {
    headers: authHeaders1,
  });
  assert.equal(missingHouse.status, 404);
});