const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");

const prisma = require("../src/lib/prisma");
const { app } = require("../src/server");

const testUserEmail = "depop_test_user@example.com";
const otherUserEmail = "depop_intruder@example.com";
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

  const body = await response.json().catch(() => null);
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

test("Priority 1: Bird Depopulation / Harvest Management 15-Point Integration Workflow", async () => {
  // Setup: Register User 1 (Authorized Owner)
  const reg1 = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: testUserEmail,
      password: "password123",
      name: "Depopulation Farmer",
    }),
  });
  assert.equal(reg1.status, 201);
  const token1 = reg1.body.data.token;
  const auth1 = { Authorization: `Bearer ${token1}` };

  // Setup: Register User 2 (Unauthorized / Intruder)
  const reg2 = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: otherUserEmail,
      password: "password123",
      name: "Intruder Farmer",
    }),
  });
  assert.equal(reg2.status, 201);
  const token2 = reg2.body.data.token;
  const auth2 = { Authorization: `Bearer ${token2}` };

  // Setup: Create a poultry house for User 1
  const houseRes = await request("/api/houses", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      name: "Layer House 1",
      birdsPlaced: 500,
      createdAt: new Date().toISOString(),
    }),
  });
  assert.equal(houseRes.status, 201);
  const houseId = houseRes.body.data.id;

  // -------------------------------------------------------------
  // 1. Create flock with 500 birds.
  // -------------------------------------------------------------
  const createFlockRes = await request("/api/flocks", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      houseId,
      name: "Layer Flock Alpha",
      batchNumber: "BATCH-500",
      purpose: "LAYER",
      birdsPlaced: 500,
      placementDate: "2026-09-01T00:00:00.000Z",
    }),
  });
  assert.equal(createFlockRes.status, 201);
  assert.equal(createFlockRes.body.data.birdsPlaced, 500);
  assert.equal(createFlockRes.body.data.currentBirds, 500);
  const flockId = createFlockRes.body.data.id;

  // -------------------------------------------------------------
  // 2. Add mortality of 20.
  // -------------------------------------------------------------
  const recordRes = await request("/api/daily-records", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      houseId,
      flockId,
      date: "2026-09-05T00:00:00.000Z",
      mortality: 20,
      feedUsedKg: 50,
      eggsCollected: 100,
    }),
  });
  assert.equal(recordRes.status, 201);
  const recordId = recordRes.body.data.id;

  // -------------------------------------------------------------
  // 3. Verify live birds = 480.
  // -------------------------------------------------------------
  const flockAfterMort = await request(`/api/flocks/${flockId}`, {
    method: "GET",
    headers: auth1,
  });
  assert.equal(flockAfterMort.status, 200);
  assert.equal(flockAfterMort.body.data.currentBirds, 480);
  assert.equal(flockAfterMort.body.data.performance.totalMortality, 20);

  // -------------------------------------------------------------
  // 4. Record SOLD = 100.
  // -------------------------------------------------------------
  const soldRes = await request("/api/depopulation-events", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      flockId,
      quantity: 100,
      reason: "SOLD",
      date: "2026-09-10T00:00:00.000Z",
      notes: "Commercial sale of live layers",
    }),
  });
  assert.equal(soldRes.status, 201);
  assert.equal(soldRes.body.data.quantity, 100);
  assert.equal(soldRes.body.data.reason, "SOLD");
  assert.equal(soldRes.body.data.liveBirdsAfter, 380);
  const soldEventId = soldRes.body.data.id;

  // -------------------------------------------------------------
  // 5. Verify live birds = 380.
  // -------------------------------------------------------------
  const flockAfterSold = await request(`/api/flocks/${flockId}`, {
    method: "GET",
    headers: auth1,
  });
  assert.equal(flockAfterSold.status, 200);
  assert.equal(flockAfterSold.body.data.currentBirds, 380);

  // -------------------------------------------------------------
  // 6. Record SLAUGHTERED = 80.
  // -------------------------------------------------------------
  const slaughterRes = await request("/api/depopulation-events", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      flockId,
      quantity: 80,
      reason: "SLAUGHTERED",
      date: "2026-09-15T00:00:00.000Z",
      notes: "Harvested for meat processing",
    }),
  });
  assert.equal(slaughterRes.status, 201);
  assert.equal(slaughterRes.body.data.quantity, 80);
  assert.equal(slaughterRes.body.data.reason, "SLAUGHTERED");
  assert.equal(slaughterRes.body.data.liveBirdsAfter, 300);
  const slaughterEventId = slaughterRes.body.data.id;

  // -------------------------------------------------------------
  // 7. Verify live birds = 300.
  // -------------------------------------------------------------
  const flockAfterSlaughter = await request(`/api/flocks/${flockId}`, {
    method: "GET",
    headers: auth1,
  });
  assert.equal(flockAfterSlaughter.status, 200);
  assert.equal(flockAfterSlaughter.body.data.currentBirds, 300);

  // Also verify through getFlocks list endpoint
  const allFlocksRes = await request("/api/flocks", {
    method: "GET",
    headers: auth1,
  });
  assert.equal(allFlocksRes.status, 200);
  const flockSummary = allFlocksRes.body.data.find((f) => f.id === flockId);
  assert.ok(flockSummary);
  assert.equal(flockSummary.currentBirds, 300);

  // -------------------------------------------------------------
  // 8. Verify mortality remains 20.
  // -------------------------------------------------------------
  assert.equal(flockAfterSlaughter.body.data.performance.totalMortality, 20);
  assert.equal(flockSummary.totalMortality, 20);

  // -------------------------------------------------------------
  // 9. Verify total depopulation = 180.
  // -------------------------------------------------------------
  assert.equal(flockAfterSlaughter.body.data.performance.totalDepopulated, 180);
  assert.equal(flockSummary.totalDepopulated, 180);

  // Verify through GET /api/depopulation-events?flockId=...
  const depopList = await request(`/api/depopulation-events?flockId=${flockId}`, {
    method: "GET",
    headers: auth1,
  });
  assert.equal(depopList.status, 200);
  assert.equal(depopList.body.data.events.length, 2);
  assert.equal(depopList.body.data.summary.totalDepopulated, 180);
  assert.equal(depopList.body.data.summary.totalMortality, 20);
  assert.equal(depopList.body.data.summary.liveBirds, 300);

  // -------------------------------------------------------------
  // 10. Attempt to remove more birds than currently available.
  // -------------------------------------------------------------
  // Currently live = 300. Attempting to remove 301 birds must fail.
  const excessiveRes = await request("/api/depopulation-events", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      flockId,
      quantity: 301,
      reason: "SOLD",
      date: "2026-09-16T00:00:00.000Z",
    }),
  });

  // -------------------------------------------------------------
  // 11. Verify request is rejected.
  // -------------------------------------------------------------
  assert.equal(excessiveRes.status, 400);
  assert.equal(excessiveRes.body.success, false);
  assert.match(excessiveRes.body.message, /Cannot remove 301 birds\. Only 300 live birds available/);

  // Verify attempting quantity 0 or negative is also rejected
  const zeroQtyRes = await request("/api/depopulation-events", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      flockId,
      quantity: 0,
      reason: "SOLD",
      date: "2026-09-16T00:00:00.000Z",
    }),
  });
  assert.equal(zeroQtyRes.status, 400);

  // -------------------------------------------------------------
  // 12. Verify another user cannot access the flock's depopulation events.
  // -------------------------------------------------------------
  // User 2 cannot list User 1's flock events
  const intruderList = await request(`/api/depopulation-events?flockId=${flockId}`, {
    method: "GET",
    headers: auth2,
  });
  assert.equal(intruderList.status, 404);

  // User 2 cannot get a specific depopulation event by ID
  const intruderGet = await request(`/api/depopulation-events/${soldEventId}`, {
    method: "GET",
    headers: auth2,
  });
  assert.equal(intruderGet.status, 404);

  // User 2 cannot update User 1's depopulation event
  const intruderPut = await request(`/api/depopulation-events/${soldEventId}`, {
    method: "PUT",
    headers: auth2,
    body: JSON.stringify({ quantity: 50 }),
  });
  assert.equal(intruderPut.status, 404);

  // User 2 cannot delete User 1's depopulation event
  const intruderDelete = await request(`/api/depopulation-events/${soldEventId}`, {
    method: "DELETE",
    headers: auth2,
  });
  assert.equal(intruderDelete.status, 404);

  // User 2 cannot create an event on User 1's flock
  const intruderCreate = await request("/api/depopulation-events", {
    method: "POST",
    headers: auth2,
    body: JSON.stringify({
      flockId,
      quantity: 10,
      reason: "CULLED",
      date: "2026-09-16T00:00:00.000Z",
    }),
  });
  assert.equal(intruderCreate.status, 404);

  // -------------------------------------------------------------
  // 13. Verify historical daily records remain intact.
  // -------------------------------------------------------------
  const recordCheck = await request(`/api/daily-records/${recordId}`, {
    method: "GET",
    headers: auth1,
  });
  assert.equal(recordCheck.status, 200);
  assert.equal(recordCheck.body.data.mortality, 20);
  assert.equal(recordCheck.body.data.feedUsedKg, 50);
  assert.equal(recordCheck.body.data.eggsCollected, 100);

  // -------------------------------------------------------------
  // 14. Verify layer laying-rate calculations use the reduced live population.
  // -------------------------------------------------------------
  // Current live birds = 300.
  // Add a new daily record with 150 eggs collected today.
  // Laying Rate = (eggsCollected / liveBirds) * 100 = (150 / 300) * 100 = 50.0%
  const day2Record = await request("/api/daily-records", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      houseId,
      flockId,
      date: "2026-09-18T00:00:00.000Z",
      mortality: 0,
      feedUsedKg: 40,
      eggsCollected: 150,
    }),
  });
  assert.equal(day2Record.status, 201);

  const flockLayingRateCheck = await request(`/api/flocks/${flockId}`, {
    method: "GET",
    headers: auth1,
  });
  assert.equal(flockLayingRateCheck.status, 200);
  // With 150 eggs and 300 live birds, laying rate must be exactly 50.0% (not 150/480 or 150/500)
  assert.equal(flockLayingRateCheck.body.data.performance.latestLayingRate, 50);

  // -------------------------------------------------------------
  // 15. Verify bird-sale financial income remains separate from mortality.
  // -------------------------------------------------------------
  // Create an Income record for bird sales
  const incomeRes = await request("/api/income", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      houseId,
      flockId,
      category: "Bird sales",
      amount: 25000,
      date: "2026-09-19T00:00:00.000Z",
      description: "Sold 50 live birds at 500 GMD each",
    }),
  });
  assert.equal(incomeRes.status, 201);
  const incomeId = incomeRes.body.data.id;

  // Record a depopulation event linked to this income record
  const depopWithIncome = await request("/api/depopulation-events", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      flockId,
      quantity: 50,
      reason: "SOLD",
      date: "2026-09-19T00:00:00.000Z",
      notes: "Commercial sale with invoice",
      incomeId,
    }),
  });
  assert.equal(depopWithIncome.status, 201);
  assert.equal(depopWithIncome.body.data.incomeId, incomeId);
  assert.equal(depopWithIncome.body.data.liveBirdsAfter, 250);

  // Verify mortality remains strictly biological (20) and is completely separate from financial income
  const finalFlockCheck = await request(`/api/flocks/${flockId}`, {
    method: "GET",
    headers: auth1,
  });
  assert.equal(finalFlockCheck.status, 200);
  assert.equal(finalFlockCheck.body.data.performance.totalMortality, 20); // Mortality still strictly 20!
  assert.equal(finalFlockCheck.body.data.currentBirds, 250); // 500 - 20 (mortality) - 230 (total depopulated)
  assert.equal(finalFlockCheck.body.data.performance.totalDepopulated, 230); // 100 + 80 + 50
  assert.equal(finalFlockCheck.body.data.financials.totalRevenue, 25000); // Financial revenue tracked separately

  // Verify house dashboard statistics deduct depopulated birds
  const dashboardRes = await request(`/api/houses/${houseId}/dashboard`, {
    method: "GET",
    headers: auth1,
  });
  assert.equal(dashboardRes.status, 200);
  // House placed (500) - Mortality (20) - Depopulated (230) = 250
  assert.equal(dashboardRes.body.data.statistics.currentBirds, 250);
  assert.equal(dashboardRes.body.data.statistics.totalMortality, 20);

  // -------------------------------------------------------------
  // Extra checks: Event Update & Deletion (Headroom & Restoration)
  // -------------------------------------------------------------
  // Test updating the event quantity: reduce soldEvent from 100 to 70 (restores 30 birds)
  const updateRes = await request(`/api/depopulation-events/${soldEventId}`, {
    method: "PUT",
    headers: auth1,
    body: JSON.stringify({
      quantity: 70,
    }),
  });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.data.liveBirdsAfter, 280); // 250 + 30 = 280

  // Verify deletion restores birds
  const deleteRes = await request(`/api/depopulation-events/${slaughterEventId}`, {
    method: "DELETE",
    headers: auth1,
  });
  assert.equal(deleteRes.status, 200);
  assert.equal(deleteRes.body.data.liveBirdsAfter, 360); // 280 + 80 = 360

  const restoredFlock = await request(`/api/flocks/${flockId}`, {
    method: "GET",
    headers: auth1,
  });
  assert.equal(restoredFlock.body.data.currentBirds, 360);
});
