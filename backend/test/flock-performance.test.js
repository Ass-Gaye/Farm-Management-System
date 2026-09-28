const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");

const prisma = require("../src/lib/prisma");
const { app } = require("../src/server");

const testUserEmail = "flock_perf_test@example.com";
const intruderUserEmail = "flock_perf_intruder@example.com";
let server;
let baseUrl;

const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();

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

test("Phase 4.3: flock performance formulas, costs, trends, isolation", async () => {
  const reg1 = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: testUserEmail, password: "password123", name: "Perf Farmer" }),
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
      name: "Layer House P1",
      address: "Brikama, The Gambia",
      birdsPlaced: 500,
      createdAt: new Date().toISOString(),
    }),
  });
  assert.equal(houseRes.status, 201);
  const houseId = houseRes.body.data.id;

  const flockRes = await request("/api/flocks", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      houseId,
      name: "Layers Perf",
      batchNumber: "LP-01",
      purpose: "LAYER",
      birdsPlaced: 500,
      placementDate: "2026-06-01T00:00:00.000Z",
    }),
  });
  assert.equal(flockRes.status, 201);
  const flockId = flockRes.body.data.id;

  // Feed type for the consumption-cost derivation (unitCost 20 GMD/kg).
  const feedRes = await request("/api/feed-types", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ name: "Layers Mash", unit: "kg", unitCost: 20, currentStock: 1000 }),
  });
  assert.equal(feedRes.status, 201);
  const feedTypeId = feedRes.body.data.id;

  const record = async (payload) => {
    const res = await request("/api/daily-records", {
      method: "POST",
      headers: auth1,
      body: JSON.stringify({ houseId, flockId, mortality: 0, feedUsedKg: 0, eggsCollected: 0, ...payload }),
    });
    assert.equal(res.status, 201, `Record failed: ${JSON.stringify(res.body)}`);
    return res.body.data.id;
  };

  // 70d ago (inside 12w, outside 30d). Aged later for correction tests.
  const oldRecordId = await record({ date: daysAgo(70), mortality: 4, feedUsedKg: 20, eggsCollected: 300 });
  await record({ date: daysAgo(5), mortality: 10, feedUsedKg: 25, eggsCollected: 400, avgWeightGrams: 1800 });
  await record({ date: daysAgo(4), mortality: 5, feedUsedKg: 26, eggsCollected: 410 });
  await record({ date: daysAgo(3), mortality: 0, feedUsedKg: 26, eggsCollected: 420 });
  // Linked feed consumption: 10kg x 20 GMD = 200 feed cost.
  await record({ date: daysAgo(1), mortality: 0, feedUsedKg: 10, feedTypeId, eggsCollected: 430 });

  // Bird sale: 50 x 300 = 15000 flock revenue.
  const depop = await request("/api/depopulation-events", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      flockId,
      quantity: 50,
      reason: "SOLD",
      date: daysAgo(2),
      unitPrice: 300,
      amount: 15000,
      amountPaid: 15000,
    }),
  });
  assert.equal(depop.status, 201, `Depop failed: ${JSON.stringify(depop.body)}`);

  // Egg sale: 100 x 12 = 1200 flock revenue.
  const eggSale = await request("/api/eggs/sales", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ houseId, flockId, quantity: 100, unitPrice: 12, amountPaid: 1200, date: daysAgo(1) }),
  });
  assert.equal(eggSale.status, 201, `Egg sale failed: ${JSON.stringify(eggSale.body)}`);

  // Flock-linked expense: 5000 medication.
  const expense = await request("/api/expenses", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ houseId, flockId, category: "Medication", amount: 5000, date: daysAgo(1) }),
  });
  assert.equal(expense.status, 201, `Expense failed: ${JSON.stringify(expense.body)}`);

  // Flock vaccination with cost 1500.
  const vacc = await request("/api/vaccinations", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ flockId, vaccineName: "Newcastle", scheduledDate: daysAgo(6), cost: 1500 }),
  });
  assert.equal(vacc.status, 201, `Vaccination failed: ${JSON.stringify(vacc.body)}`);

  const detail = await request(`/api/flocks/${flockId}`, { method: "GET", headers: auth1 });
  assert.equal(detail.status, 200);
  const perf = detail.body.data.performance;
  const fin = detail.body.data.financials;

  // A. mortalityRate = (19 / 500) * 100 = 3.8
  assert.equal(perf.totalMortality, 19);
  assert.equal(perf.mortalityRate, 3.8);

  // B. liveBirds = max(0, 500 - 19 - 50) = 431
  assert.equal(detail.body.data.currentBirds, 431);

  // C. fcr = 107 / ((431 * 1800) / 1000) = 107 / 775.8 = 0.14
  assert.equal(perf.totalFeedKg, 107);
  assert.equal(perf.latestWeightGrams, 1800);
  assert.equal(perf.fcr, 0.14);

  // D. average = 1960 / (431 * 5) * 100 = 91.0; latest = 430 / 431 * 100 = 99.8
  assert.equal(perf.totalEggs, 1960);
  assert.equal(perf.averageLayingRate, 91.0);
  assert.equal(perf.latestLayingRate, 99.8);
  assert.equal(perf.avgDailyFeedKg, 21.4);

  // E. netProfitLoss = (15000 + 1200) - 5000 = 11200
  assert.equal(fin.totalRevenue, 16200);
  assert.equal(fin.totalExpenses, 5000);
  assert.equal(fin.netProfitLoss, 11200);
  assert.equal(fin.costPerBird, 10);
  assert.equal(fin.revenuePerBird, 32.4);

  // F + G. derived costs
  assert.equal(fin.feedCost, 200);
  assert.equal(fin.vaccineCost, 1500);

  // Age the old record, then correct it (out-of-window path).
  await prisma.dailyRecord.update({
    where: { id: oldRecordId },
    data: { createdAt: new Date(Date.now() - 30 * 864e5) },
  });
  const eggCorr = await request(`/api/daily-records/${oldRecordId}/corrections`, {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ field: "EGGS", correctedValue: 350, reason: "Recount" }),
  });
  assert.equal(eggCorr.status, 201);
  const mortCorr = await request(`/api/daily-records/${oldRecordId}/corrections`, {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ field: "MORTALITY", correctedValue: 6, reason: "Recount" }),
  });
  assert.equal(mortCorr.status, 201);

  // H. 30d trends: 4 daily periods, corrected values, live birds per date.
  const t30 = await request(`/api/flocks/${flockId}/trends?range=30d`, { method: "GET", headers: auth1 });
  assert.equal(t30.status, 200);
  assert.equal(t30.body.data.range, "30d");
  assert.equal(t30.body.data.flock.id, flockId);
  assert.equal(t30.body.data.periods.length, 4);
  assert.deepEqual(
    t30.body.data.periods.map((p) => p.eggs),
    [400, 410, 420, 430]
  );
  assert.deepEqual(
    t30.body.data.periods.map((p) => p.mortality),
    [10, 5, 0, 0]
  );
  assert.deepEqual(
    t30.body.data.periods.map((p) => p.feedKg),
    [25, 26, 26, 10]
  );
  // Cumulative: 70d record corrected to 6 mortality before these dates.
  // 5d: 500 - (6+10) = 484; 4d: 500 - 21 = 479; 3d: 479; 1d: 500 - 21 - 50 = 429.
  assert.deepEqual(
    t30.body.data.periods.map((p) => p.liveBirds),
    [484, 479, 479, 429]
  );

  // H. 12w trends: includes the corrected 70d record (350 eggs, 6 mortality).
  const t12 = await request(`/api/flocks/${flockId}/trends?range=12w`, { method: "GET", headers: auth1 });
  assert.equal(t12.status, 200);
  assert.equal(t12.body.data.range, "12w");
  const eggSum = t12.body.data.periods.reduce((s, p) => s + p.eggs, 0);
  const mortSum = t12.body.data.periods.reduce((s, p) => s + p.mortality, 0);
  assert.equal(eggSum, 2010); // 1960 + 50 correction delta
  assert.equal(mortSum, 21); // 19 + 2 correction delta
  for (const p of t12.body.data.periods) {
    assert.ok(p.date && typeof p.eggs === "number" && typeof p.mortality === "number" && typeof p.feedKg === "number" && typeof p.liveBirds === "number");
  }

  // H. invalid range + nonexistent flock.
  const badRange = await request(`/api/flocks/${flockId}/trends?range=7d`, { method: "GET", headers: auth1 });
  assert.equal(badRange.status, 400);
  const noFlock = await request("/api/flocks/99999999/trends?range=30d", { method: "GET", headers: auth1 });
  assert.equal(noFlock.status, 404);

  // I. cross-user isolation.
  const crossDetail = await request(`/api/flocks/${flockId}`, { method: "GET", headers: auth2 });
  assert.equal(crossDetail.status, 404);
  const crossTrends = await request(`/api/flocks/${flockId}/trends?range=30d`, { method: "GET", headers: auth2 });
  assert.equal(crossTrends.status, 404);
});
