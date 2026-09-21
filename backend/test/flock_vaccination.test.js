const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");

const prisma = require("../src/lib/prisma");
const { app } = require("../src/server");

const testUserEmail = "flock_test_farmer@example.com";
const otherUserEmail = "other_flock_farmer@example.com";
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

const cleanup = async () => {
  await prisma.user.deleteMany({
    where: {
      email: { in: [testUserEmail, otherUserEmail] },
    },
  });
};

before(async () => {
  await cleanup();

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  await cleanup();
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await prisma.$disconnect();
});

test("Flock, DailyRecord, and Vaccination integration workflow", async () => {
  // 1. Register User 1
  const regRes = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: testUserEmail,
      password: "password123",
      name: "Flock Test Farmer",
    }),
  });
  assert.equal(regRes.status, 201);
  const token = regRes.body.data.token;
  const authHeaders = { Authorization: `Bearer ${token}` };

  // Register User 2 (for authorization / isolation testing)
  const regRes2 = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: otherUserEmail,
      password: "password123",
      name: "Other Farmer",
    }),
  });
  assert.equal(regRes2.status, 201);
  const token2 = regRes2.body.data.token;
  const authHeaders2 = { Authorization: `Bearer ${token2}` };

  // 2. Create poultry house
  const houseRes = await request("/api/houses", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      name: "House Alpha",
      birdsPlaced: 1000,
      createdAt: new Date().toISOString(),
    }),
  });
  assert.equal(houseRes.status, 201);
  const houseId = houseRes.body.data.id;

  // 3. Create Flock 1 in House Alpha
  const flock1Res = await request("/api/flocks", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      houseId,
      name: "Batch 2026-A",
      batchNumber: "B26A",
      purpose: "BROILER",
      birdsPlaced: 500,
      placementDate: "2026-01-10T00:00:00.000Z",
      status: "ACTIVE",
    }),
  });
  assert.equal(flock1Res.status, 201);
  assert.equal(flock1Res.body.data.currentBirds, 500);
  assert.ok(flock1Res.body.data.age);
  const flock1Id = flock1Res.body.data.id;

  // 4. Create Flock 2 in same House Alpha
  const flock2Res = await request("/api/flocks", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      houseId,
      name: "Batch 2026-B",
      batchNumber: "B26B",
      purpose: "LAYER",
      birdsPlaced: 300,
      placementDate: "2026-02-01T00:00:00.000Z",
      status: "ACTIVE",
    }),
  });
  assert.equal(flock2Res.status, 201);
  const flock2Id = flock2Res.body.data.id;

  // Verify unauthorized user cannot access User 1's flock
  const unauthFlockRes = await request(`/api/flocks/${flock1Id}`, {
    headers: authHeaders2,
  });
  assert.equal(unauthFlockRes.status, 404);

  // 5. Mark Flock 1 as COMPLETED
  const updateFlock1Res = await request(`/api/flocks/${flock1Id}`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      status: "COMPLETED",
    }),
  });
  assert.equal(updateFlock1Res.status, 200);
  assert.equal(updateFlock1Res.body.data.status, "COMPLETED");

  // 6. Add Daily Record to Flock 1
  const daily1Res = await request("/api/daily-records", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      houseId,
      flockId: flock1Id,
      date: "2026-01-15T00:00:00.000Z",
      mortality: 10,
      feedUsedKg: 50,
      eggsCollected: 0,
      avgWeightGrams: 450,
    }),
  });
  assert.equal(daily1Res.status, 201);

  // 7. Add Daily Record to Flock 2 (on a different date)
  const daily2Res = await request("/api/daily-records", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      houseId,
      flockId: flock2Id,
      date: "2026-02-05T00:00:00.000Z",
      mortality: 5,
      feedUsedKg: 30,
      eggsCollected: 120,
    }),
  });
  assert.equal(daily2Res.status, 201);

  // 8. Verify mortality and live bird counts are separated per flock
  const flock1Check = await request(`/api/flocks/${flock1Id}`, { headers: authHeaders });
  assert.equal(flock1Check.status, 200);
  assert.equal(flock1Check.body.data.performance.totalMortality, 10);
  assert.equal(flock1Check.body.data.currentBirds, 490);
  assert.equal(flock1Check.body.data.performance.latestWeightGrams, 450);
  assert.ok(flock1Check.body.data.performance.fcr > 0);

  const flock2Check = await request(`/api/flocks/${flock2Id}`, { headers: authHeaders });
  assert.equal(flock2Check.status, 200);
  assert.equal(flock2Check.body.data.performance.totalMortality, 5);
  assert.equal(flock2Check.body.data.currentBirds, 295);
  assert.equal(flock2Check.body.data.performance.totalEggs, 120);
  assert.ok(flock2Check.body.data.performance.latestLayingRate > 0);

  // 9. Verify cross-flock / cross-user security: User 2 cannot create record with User 1's flock
  const crossUserDaily = await request("/api/daily-records", {
    method: "POST",
    headers: authHeaders2,
    body: JSON.stringify({
      houseId,
      flockId: flock1Id,
      date: "2026-03-01T00:00:00.000Z",
      mortality: 1,
      feedUsedKg: 5,
      eggsCollected: 0,
    }),
  });
  assert.ok(crossUserDaily.status === 404 || crossUserDaily.status === 400);

  // 10. Test Vaccination Management
  // Auto-schedule template vaccinations for Flock 1 (BROILER)
  const autoVaccRes = await request("/api/vaccinations/auto-schedule", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ flockId: flock1Id }),
  });
  assert.equal(autoVaccRes.status, 201);
  assert.ok(autoVaccRes.body.data.length >= 4);

  // Create manual vaccination for Flock 2
  const manualVaccRes = await request("/api/vaccinations", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      flockId: flock2Id,
      vaccineName: "Marek's Disease Vaccine",
      disease: "Marek's",
      scheduledDate: "2026-02-02T00:00:00.000Z",
      status: "PENDING",
      dosage: "0.2ml",
    }),
  });
  assert.equal(manualVaccRes.status, 201);
  const vaccId = manualVaccRes.body.data.id;

  // Update vaccination to COMPLETED
  const updateVaccRes = await request(`/api/vaccinations/${vaccId}`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      status: "COMPLETED",
      administeredBy: "Dr. Gaye",
      cost: 150,
    }),
  });
  assert.equal(updateVaccRes.status, 200);
  assert.equal(updateVaccRes.body.data.status, "COMPLETED");
  assert.equal(updateVaccRes.body.data.administeredBy, "Dr. Gaye");
  assert.ok(updateVaccRes.body.data.administeredDate);

  // User 2 cannot access or delete User 1's vaccination
  const unauthVaccDel = await request(`/api/vaccinations/${vaccId}`, {
    method: "DELETE",
    headers: authHeaders2,
  });
  assert.equal(unauthVaccDel.status, 404);

  // 11. Test deletion of daily record restores flock bird count
  const deleteRecRes = await request(`/api/daily-records/${daily1Res.body.data.id}`, {
    method: "DELETE",
    headers: authHeaders,
  });
  assert.equal(deleteRecRes.status, 200);

  const flock1Restored = await request(`/api/flocks/${flock1Id}`, { headers: authHeaders });
  assert.equal(flock1Restored.body.data.currentBirds, 500); // Restored back from 490 to 500!
});
