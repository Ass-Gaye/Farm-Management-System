const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");

const prisma = require("../src/lib/prisma");
const { app } = require("../src/server");

const testUserEmail = "flock_closeout_test@example.com";
const intruderUserEmail = "flock_closeout_intruder@example.com";
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
      email: { in: [testUserEmail, intruderUserEmail] },
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

test("Phase 4.4: flock closeout, operational lock, reconciliation", async () => {
  const reg1 = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: testUserEmail, password: "password123", name: "Closeout Farmer" }),
  });
  assert.equal(reg1.status, 201);
  const auth1 = { Authorization: `Bearer ${reg1.body.data.token}` };

  const reg2 = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: intruderUserEmail, password: "password123", name: "Intruder" }),
  });
  assert.equal(reg2.status, 201);
  const auth2 = { Authorization: `Bearer ${reg2.body.data.token}` };

  const houseRes = await request("/api/houses", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      name: "Closeout House",
      address: "Brikama, The Gambia",
      birdsPlaced: 500,
      createdAt: new Date().toISOString(),
    }),
  });
  assert.equal(houseRes.status, 201);
  const houseId = houseRes.body.data.id;

  const mkFlock = async (name, birds, purpose) => {
    const res = await request("/api/flocks", {
      method: "POST",
      headers: auth1,
      body: JSON.stringify({
        houseId,
        name,
        purpose,
        birdsPlaced: birds,
        placementDate: "2026-06-01T00:00:00.000Z",
      }),
    });
    assert.equal(res.status, 201);
    return res.body.data.id;
  };

  const flockA = await mkFlock("Closeout A", 200, "LAYER");
  const flockB = await mkFlock("Closeout B", 20, "BROILER");

  // Operational history on A: mortality 10, feed 5kg, eggs 100.
  const recA = await request("/api/daily-records", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      houseId,
      flockId: flockA,
      date: "2026-09-10T00:00:00.000Z",
      mortality: 10,
      feedUsedKg: 5,
      eggsCollected: 100,
    }),
  });
  assert.equal(recA.status, 201);
  const recAId = recA.body.data.id;

  // B is fully depopulated (20 SOLD) for a clean close.
  const depopB = await request("/api/depopulation-events", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      flockId: flockB,
      quantity: 20,
      reason: "SOLD",
      date: "2026-09-11T00:00:00.000Z",
      unitPrice: 300,
      amount: 6000,
      amountPaid: 6000,
    }),
  });
  assert.equal(depopB.status, 201);

  // --- 3. Closeout rejects remaining birds without acknowledgment ---
  const noAck = await request(`/api/flocks/${flockA}/closeout`, {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ status: "COMPLETED" }),
  });
  assert.equal(noAck.status, 400);
  assert.match(noAck.body.message, /190/);

  // --- 1+2+4. Close with acknowledgment; verify reconciliation ---
  const closeA = await request(`/api/flocks/${flockA}/closeout`, {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ status: "COMPLETED", acknowledgeRemainingBirds: true, notes: "Batch done" }),
  });
  assert.equal(closeA.status, 200, `Closeout failed: ${JSON.stringify(closeA.body)}`);
  assert.equal(closeA.body.data.status, "COMPLETED");
  assert.equal(closeA.body.data.transition, "CLOSE");
  assert.deepEqual(closeA.body.data.birds, {
    birdsPlaced: 200,
    correctedMortality: 10,
    totalDepopulated: 0,
    liveBirds: 190,
    mortalityRate: 5.0,
  });
  assert.equal(closeA.body.data.production.totalEggs, 100);
  assert.equal(closeA.body.data.production.totalFeedKg, 5);
  assert.equal(closeA.body.data.eggFlow.produced, 100);
  assert.equal(closeA.body.data.financials.totalRevenue, 0);
  assert.equal(closeA.body.data.financials.netProfitLoss, 0);

  // NO_OP: closing again with the same status succeeds idempotently.
  const noop = await request(`/api/flocks/${flockA}/closeout`, {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ status: "COMPLETED", acknowledgeRemainingBirds: true }),
  });
  assert.equal(noop.status, 200);
  assert.equal(noop.body.data.transition, "NO_OP");

  // RECLOSE: COMPLETED -> ARCHIVED.
  const reclose = await request(`/api/flocks/${flockA}/closeout`, {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ status: "ARCHIVED", acknowledgeRemainingBirds: true }),
  });
  assert.equal(reclose.status, 200);
  assert.equal(reclose.body.data.transition, "RECLOSE");
  assert.equal(reclose.body.data.status, "ARCHIVED");

  // Clean close of B (0 live birds, no acknowledgment needed).
  const closeB = await request(`/api/flocks/${flockB}/closeout`, {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ status: "SOLD" }),
  });
  assert.equal(closeB.status, 200);
  assert.equal(closeB.body.data.birds.liveBirds, 0);
  assert.equal(closeB.body.data.financials.totalRevenue, 6000);

  // --- 5-8. Closed flock blocks new operational records (A is ARCHIVED) ---
  const blockedRecord = await request("/api/daily-records", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      houseId,
      flockId: flockA,
      date: "2026-09-12T00:00:00.000Z",
      mortality: 0,
      feedUsedKg: 1,
      eggsCollected: 5,
    }),
  });
  assert.equal(blockedRecord.status, 400);
  assert.match(blockedRecord.body.message, /closed/i);

  // House-scope records (no flock) still work.
  const houseRecord = await request("/api/daily-records", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      houseId,
      date: "2026-09-12T00:00:00.000Z",
      mortality: 0,
      feedUsedKg: 0,
      eggsCollected: 0,
    }),
  });
  assert.equal(houseRecord.status, 201);

  const blockedDepop = await request("/api/depopulation-events", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ flockId: flockA, quantity: 1, reason: "CULLED", date: "2026-09-12T00:00:00.000Z" }),
  });
  assert.equal(blockedDepop.status, 400);

  const blockedSale = await request("/api/eggs/sales", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ houseId, flockId: flockA, quantity: 2, unitPrice: 10, date: "2026-09-12T00:00:00.000Z" }),
  });
  assert.equal(blockedSale.status, 400);

  // Farm-level egg sale (no flock) still works.
  const farmSale = await request("/api/eggs/sales", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ houseId, quantity: 2, unitPrice: 10, date: "2026-09-12T00:00:00.000Z" }),
  });
  assert.equal(farmSale.status, 201);

  const blockedVacc = await request("/api/vaccinations", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ flockId: flockA, vaccineName: "Test", scheduledDate: "2026-09-20T00:00:00.000Z" }),
  });
  assert.equal(blockedVacc.status, 400);

  const blockedTemplate = await request("/api/vaccinations/auto-schedule", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ flockId: flockA }),
  });
  assert.equal(blockedTemplate.status, 400);

  // Slaughter completion onto a closed flock is blocked (flockId set directly).
  const planRes = await request("/api/slaughter-plans", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      houseId,
      numberOfBirds: 5,
      placementDate: "2026-06-01T00:00:00.000Z",
      expectedSlaughterDate: "2026-12-01T00:00:00.000Z",
    }),
  });
  assert.equal(planRes.status, 201);
  await prisma.slaughterPlan.update({ where: { id: planRes.body.data.id }, data: { flockId: flockA } });
  const blockedComplete = await request(`/api/slaughter-plans/${planRes.body.data.id}/complete`, {
    method: "PATCH",
    headers: auth1,
    body: JSON.stringify({ completed: true }),
  });
  assert.equal(blockedComplete.status, 400);
  assert.match(blockedComplete.body.message, /closed/i);

  // Moving an existing record onto a closed flock is blocked.
  const moveRecord = await request(`/api/daily-records/${houseRecord.body.data.id}`, {
    method: "PUT",
    headers: auth1,
    body: JSON.stringify({ flockId: flockA }),
  });
  assert.equal(moveRecord.status, 400);

  // --- 13. Corrections on closed flocks still work (audit stays fixable) ---
  await prisma.dailyRecord.update({
    where: { id: recAId },
    data: { createdAt: new Date(Date.now() - 30 * 864e5) },
  });
  const corr = await request(`/api/daily-records/${recAId}/corrections`, {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ field: "EGGS", correctedValue: 120, reason: "Recount after closeout" }),
  });
  assert.equal(corr.status, 201, `Correction failed: ${JSON.stringify(corr.body)}`);

  // --- 9+10. Reopen restores operations ---
  const reopen = await request(`/api/flocks/${flockA}/closeout`, {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ status: "ACTIVE" }),
  });
  assert.equal(reopen.status, 200);
  assert.equal(reopen.body.data.transition, "REOPEN");

  const afterReopen = await request("/api/daily-records", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      houseId,
      flockId: flockA,
      date: "2026-09-13T00:00:00.000Z",
      mortality: 0,
      feedUsedKg: 0,
      eggsCollected: 10,
    }),
  });
  assert.equal(afterReopen.status, 201);

  // --- 11+12. Foreign user cannot close or reopen ---
  const crossClose = await request(`/api/flocks/${flockA}/closeout`, {
    method: "POST",
    headers: auth2,
    body: JSON.stringify({ status: "COMPLETED", acknowledgeRemainingBirds: true }),
  });
  assert.equal(crossClose.status, 404);

  // --- 14+15. No double-counting: reopen B, then attach flock-linked
  // expense, consumption-derived feed cost, and vaccination cost ---
  const reopenB = await request(`/api/flocks/${flockB}/closeout`, {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ status: "ACTIVE" }),
  });
  assert.equal(reopenB.status, 200);

  const feedTypeRes = await request("/api/feed-types", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ name: "Closeout Feed", unit: "kg", unitCost: 10, currentStock: 500 }),
  });
  assert.equal(feedTypeRes.status, 201);

  const feedRec = await request("/api/daily-records", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      houseId,
      flockId: flockB,
      date: "2026-09-14T00:00:00.000Z",
      mortality: 0,
      feedUsedKg: 5,
      feedTypeId: feedTypeRes.body.data.id,
      eggsCollected: 0,
    }),
  });
  assert.equal(feedRec.status, 201);

  const flockExpense = await request("/api/expenses", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ houseId, flockId: flockB, category: "Medication", amount: 1000, date: "2026-09-13T00:00:00.000Z" }),
  });
  assert.equal(flockExpense.status, 201);

  const vaccB = await request("/api/vaccinations", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ flockId: flockB, vaccineName: "Gumboro", scheduledDate: "2026-09-14T00:00:00.000Z", cost: 200 }),
  });
  assert.equal(vaccB.status, 201);

  const detailB = await request(`/api/flocks/${flockB}`, { method: "GET", headers: auth1 });
  assert.equal(detailB.status, 200);
  const finB = detailB.body.data.financials;
  assert.equal(finB.totalExpenses, 1000);
  assert.equal(finB.totalRevenue, 6000);
  assert.equal(finB.feedCost, 50); // 5kg x 10 GMD from CONSUMPTION movements
  assert.equal(finB.vaccineCost, 200);
  // Net uses linked rows only: components are informational, not added again.
  assert.equal(finB.netProfitLoss, 5000);

  // --- 16. Egg reconciliation is flow-based, not farm stock ---
  // Farm stock: 100 (A) + 0 (house) - 2 (farm sale) + 20 (correction) + 10 (A reopen) = 128.
  const stockRes = await request("/api/eggs/inventory", { method: "GET", headers: auth1 });
  assert.equal(stockRes.status, 200);
  assert.equal(stockRes.body.data.currentStock, 128);
  // A's closeout flow reported only A's own production (100), not farm stock.
  assert.equal(closeA.body.data.eggFlow.produced, 100);

  // --- 12b. Foreign user cannot reopen a closed flock ---
  const closeAgain = await request(`/api/flocks/${flockA}/closeout`, {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ status: "COMPLETED", acknowledgeRemainingBirds: true }),
  });
  assert.equal(closeAgain.status, 200);
  const crossReopen = await request(`/api/flocks/${flockA}/closeout`, {
    method: "POST",
    headers: auth2,
    body: JSON.stringify({ status: "ACTIVE" }),
  });
  assert.equal(crossReopen.status, 404);
  const reopenFinal = await request(`/api/flocks/${flockA}/closeout`, {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ status: "ACTIVE" }),
  });
  assert.equal(reopenFinal.status, 200);
});
