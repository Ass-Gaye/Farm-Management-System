const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");

const prisma = require("../src/lib/prisma");
const { app } = require("../src/server");

const email = "historical_corrections@example.com";
const houseName = "__hc_house__";
let server;
let baseUrl;

const request = async (path, options = {}) => {
  const { headers, ...rest } = options;
  const res = await fetch(`${baseUrl}${path}`, {
    ...rest,
    headers: { "Content-Type": "application/json", ...headers },
  });
  return { status: res.status, body: await res.json() };
};

const cleanup = async () => {
  await prisma.user.deleteMany({ where: { email } });
  const houses = await prisma.poultryHouse.findMany({
    where: { name: houseName },
    select: { id: true },
  });
  if (houses.length) {
    await prisma.poultryHouse.deleteMany({
      where: { id: { in: houses.map((h) => h.id) } },
    });
  }
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
    await new Promise((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve()))
    );
  }
  await prisma.$disconnect();
});

test("Historical corrections: feed locks, deactivation, mortality/egg fixes", async () => {
  const reg = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password: "password123", name: "HC Farmer" }),
  });
  assert.equal(reg.status, 201);
  const h = { Authorization: `Bearer ${reg.body.data.token}` };

  const house = await request("/api/houses", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ name: houseName, address: "HC Town", birdsPlaced: 500, createdAt: "2026-09-01" }),
  });
  assert.equal(house.status, 201);
  const houseId = house.body.data.id;

  const flock = await request("/api/flocks", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ houseId, name: "HC Flock 001", birdsPlaced: 100, placementDate: "2026-09-01" }),
  });
  assert.equal(flock.status, 201);
  const flockId = flock.body.data.id;

  // ---------- A: unit change with stock rejected, stock unchanged ----------
  const feedA = await request("/api/feed-types", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ name: "HC Bulk", unit: "kg", currentStock: 2250, unitCost: 10 }),
  });
  assert.equal(feedA.status, 201);
  const lockedUnit = await request(`/api/feed-types/${feedA.body.data.id}`, {
    method: "PUT",
    headers: h,
    body: JSON.stringify({ unit: "bags", bagWeightKg: 50 }),
  });
  assert.equal(lockedUnit.status, 400);
  assert.ok(lockedUnit.body.message.toLowerCase().includes("cannot be changed"));
  const feedAAfter = await request(`/api/feed-types/${feedA.body.data.id}`, { headers: h });
  assert.equal(feedAAfter.body.data.unit, "kg");
  assert.equal(feedAAfter.body.data.currentStock, 2250);

  // ---------- B: bag-weight change with movements (zero stock) rejected ----------
  const feedB = await request("/api/feed-types", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ name: "HC Cycled", unit: "kg", currentStock: 0 }),
  });
  assert.equal(feedB.status, 201);
  const feedBId = feedB.body.data.id;
  const buyB = await request("/api/expenses", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      feedTypeId: feedBId, category: "Feed", quantity: 10, unit: "kg",
      unitPrice: 5, date: new Date().toISOString(),
    }),
  });
  assert.equal(buyB.status, 201);
  const useB = await request("/api/daily-records", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      houseId, date: "2026-11-01", mortality: 0,
      feedUsedKg: 10, eggsCollected: 0, feedTypeId: feedBId,
    }),
  });
  assert.equal(useB.status, 201);
  const lockedBag = await request(`/api/feed-types/${feedBId}`, {
    method: "PUT",
    headers: h,
    body: JSON.stringify({ bagWeightKg: 60 }),
  });
  assert.equal(lockedBag.status, 400);

  // ---------- C: unit change with no stock and no movements allowed ----------
  const feedC = await request("/api/feed-types", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ name: "HC Fresh", unit: "kg", currentStock: 0 }),
  });
  assert.equal(feedC.status, 201);
  const changeC = await request(`/api/feed-types/${feedC.body.data.id}`, {
    method: "PUT",
    headers: h,
    body: JSON.stringify({ unit: "bags", bagWeightKg: 50 }),
  });
  assert.equal(changeC.status, 200);
  assert.equal(changeC.body.data.unit, "bags");

  // ---------- D/E: deactivation guard + history preserved ----------
  const deactBlocked = await request(`/api/feed-types/${feedA.body.data.id}`, {
    method: "PUT",
    headers: h,
    body: JSON.stringify({ active: false }),
  });
  assert.equal(deactBlocked.status, 400);
  assert.ok(deactBlocked.body.message.toLowerCase().includes("while stock remains"));

  const deactOk = await request(`/api/feed-types/${feedC.body.data.id}`, {
    method: "PUT",
    headers: h,
    body: JSON.stringify({ active: false }),
  });
  assert.equal(deactOk.status, 200);
  assert.equal(deactOk.body.data.active, false);

  // History of a deactivated feed remains available.
  const movesB = await request(`/api/inventory/movements?feedTypeId=${feedBId}&limit=100`, { headers: h });
  assert.ok(movesB.body.data.movements.length >= 2);
  const deactB = await request(`/api/feed-types/${feedBId}`, {
    method: "PUT",
    headers: h,
    body: JSON.stringify({ active: false }),
  });
  assert.equal(deactB.status, 200);
  const movesAfterDeact = await request(`/api/inventory/movements?feedTypeId=${feedBId}&limit=100`, { headers: h });
  assert.equal(movesAfterDeact.body.data.movements.length, movesB.body.data.movements.length);
  const feedBAfter = await request(`/api/feed-types/${feedBId}`, { headers: h });
  assert.equal(feedBAfter.status, 200);

  // ---------- F: old mortality correction 20 -> 15 ----------
  const recF = await request("/api/daily-records", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      houseId, flockId, date: "2026-11-02", mortality: 20,
      feedUsedKg: 0, eggsCollected: 40,
    }),
  });
  assert.equal(recF.status, 201);
  const recFId = recF.body.data.id;
  await prisma.dailyRecord.update({
    where: { id: recFId },
    data: { createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
  });

  const corrF = await request(`/api/daily-records/${recFId}/corrections`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ field: "MORTALITY", correctedValue: 15, reason: "Recount showed 15, not 20" }),
  });
  assert.equal(corrF.status, 201);
  assert.equal(corrF.body.data.previousValue, 20);
  assert.equal(corrF.body.data.adjustment, -5);
  assert.equal(corrF.body.data.correctedResult, 15);

  // Original unchanged; corrected result flows into reads and reporting.
  const recFAfter = await request(`/api/daily-records/${recFId}`, { headers: h });
  assert.equal(recFAfter.body.data.mortality, 20);
  assert.equal(recFAfter.body.data.correctedMortality, 15);
  assert.equal(recFAfter.body.data.corrections.length, 1);
  const flockAfterF = await request(`/api/flocks/${flockId}`, { headers: h });
  assert.equal(flockAfterF.body.data.performance.totalMortality, 15);
  const dashF = await request(`/api/houses/${houseId}/dashboard`, { headers: h });
  assert.equal(dashF.body.data.statistics.totalMortality, 15); // 0 + 15 corrected + 0
  assert.equal(dashF.body.data.statistics.currentBirds, 485);

  // ---------- G: invalid mortality correction rejected ----------
  const depop = await request("/api/depopulation-events", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ flockId, quantity: 75, reason: "SOLD", date: "2026-11-03" }),
  });
  assert.equal(depop.status, 201); // live was 85 (100 - 15 corrected)
  const badCorr = await request(`/api/daily-records/${recFId}/corrections`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ field: "MORTALITY", correctedValue: 30, reason: "Should fail: 30 + 75 > 100" }),
  });
  assert.equal(badCorr.status, 400);
  assert.ok(badCorr.body.message.toLowerCase().includes("later bird events"));
  const recFAfterBad = await request(`/api/daily-records/${recFId}`, { headers: h });
  assert.equal(recFAfterBad.body.data.correctedMortality, 15);
  assert.equal(recFAfterBad.body.data.corrections.length, 1);

  // ---------- H: old egg correction 1500 -> 1350 ----------
  const recH = await request("/api/daily-records", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      houseId, date: "2026-11-04", mortality: 0,
      feedUsedKg: 0, eggsCollected: 1500,
    }),
  });
  assert.equal(recH.status, 201);
  await prisma.dailyRecord.update({
    where: { id: recH.body.data.id },
    data: { createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
  });
  const corrH = await request(`/api/daily-records/${recH.body.data.id}/corrections`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ field: "EGGS", correctedValue: 1350, reason: "Data entry typo" }),
  });
  assert.equal(corrH.status, 201);
  assert.equal(corrH.body.data.adjustment, -150);
  const recHAfter = await request(`/api/daily-records/${recH.body.data.id}`, { headers: h });
  assert.equal(recHAfter.body.data.eggsCollected, 1500);
  assert.equal(recHAfter.body.data.correctedEggs, 1350);
});
