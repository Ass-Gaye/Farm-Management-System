const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");

const prisma = require("../src/lib/prisma");
const { app } = require("../src/server");

const email = "daily_consumption@example.com";
const houseName = "__dc_house__";
const house2Name = "__dc_house2__";
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
    where: { name: { in: [houseName, house2Name] } },
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

const stockOf = async (feedId, headers) => {
  const r = await request(`/api/feed-types/${feedId}`, { headers });
  assert.equal(r.status, 200);
  return r.body.data.currentStock;
};

test("Daily consumption: auto deduction, scope, window, concurrency, duplicates", async () => {
  const reg = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password: "password123", name: "DC Farmer" }),
  });
  assert.equal(reg.status, 201);
  const h = { Authorization: `Bearer ${reg.body.data.token}` };

  const house = await request("/api/houses", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ name: houseName, address: "DC Town", birdsPlaced: 500, createdAt: "2026-09-01" }),
  });
  assert.equal(house.status, 201);
  const houseId = house.body.data.id;

  const house2 = await request("/api/houses", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ name: house2Name, address: "DC Town", birdsPlaced: 50, createdAt: "2026-09-01" }),
  });
  assert.equal(house2.status, 201);

  const flock = await request("/api/flocks", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ houseId, name: "DC Flock 001", birdsPlaced: 100, placementDate: "2026-09-01" }),
  });
  assert.equal(flock.status, 201);
  const flockId = flock.body.data.id;
  const flockName = flock.body.data.name;

  const feed = await request("/api/feed-types", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ name: "DC Starter", unit: "kg", minimumStock: 0, currentStock: 250, unitCost: 10 }),
  });
  assert.equal(feed.status, 201);
  const feedId = feed.body.data.id;

  // TEST 5 + TEST 1: house-scope record auto-deducts 150 from shared stock.
  const rec1 = await request("/api/daily-records", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      houseId, flockId: null, date: "2026-10-01", mortality: 0,
      feedUsedKg: 150, eggsCollected: 10, feedTypeId: feedId,
    }),
  });
  assert.equal(rec1.status, 201);
  assert.equal(rec1.body.data.flockId, null); // HOUSE scope
  assert.ok(rec1.body.inventory);
  assert.equal(rec1.body.inventory.stockBefore, 250);
  assert.equal(rec1.body.inventory.stockAfter, 100);
  assert.equal(rec1.body.inventory.consumedInFeedUnit, 150);
  assert.equal(await stockOf(feedId, h), 100);

  // TEST 8: CONSUMPTION movement appears with correct references.
  const moves1 = await request(`/api/inventory/movements?feedTypeId=${feedId}&type=CONSUMPTION`, { headers: h });
  assert.equal(moves1.status, 200);
  assert.equal(moves1.body.data.movements.length, 1);
  const mv1 = moves1.body.data.movements[0];
  assert.equal(mv1.quantity, -150);
  assert.equal(mv1.balanceAfter, 100);
  assert.equal(mv1.dailyRecordId, rec1.body.data.id);
  assert.equal(mv1.houseId, houseId);

  // TEST 6: flock-scope record + invalid house/flock combo rejected.
  const recFlock = await request("/api/daily-records", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      houseId, flockId, date: "2026-10-02", mortality: 0,
      feedUsedKg: 20, eggsCollected: 5, feedTypeId: feedId,
    }),
  });
  assert.equal(recFlock.status, 201);
  assert.equal(recFlock.body.data.flockId, flockId); // FLOCK scope
  assert.equal(await stockOf(feedId, h), 80);

  const movesFlock = await request(
    `/api/inventory/movements?feedTypeId=${feedId}&type=CONSUMPTION`, { headers: h }
  );
  const flockMove = movesFlock.body.data.movements.find((m) => m.dailyRecordId === recFlock.body.data.id);
  assert.ok(flockMove);
  assert.equal(flockMove.dailyRecord.flock.name, flockName);

  const badCombo = await request("/api/daily-records", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      houseId: house2.body.data.id, flockId, date: "2026-10-03", mortality: 0,
      feedUsedKg: 5, eggsCollected: 0, feedTypeId: feedId,
    }),
  });
  assert.equal(badCombo.status, 400);
  assert.equal(await stockOf(feedId, h), 80);

  // TEST 2: insufficient stock rejected, nothing persisted.
  const over = await request("/api/daily-records", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      houseId, date: "2026-10-04", mortality: 0,
      feedUsedKg: 150, eggsCollected: 0, feedTypeId: feedId,
    }),
  });
  assert.equal(over.status, 400);
  assert.equal(await stockOf(feedId, h), 80);
  const movesAfterOver = await request(
    `/api/inventory/movements?feedTypeId=${feedId}&type=CONSUMPTION`, { headers: h }
  );
  assert.equal(movesAfterOver.body.data.movements.length, 2);

  // TEST 7: concurrent consumption never drives stock negative.
  const [c1, c2] = await Promise.all([
    request("/api/daily-records", {
      method: "POST", headers: h,
      body: JSON.stringify({ houseId, date: "2026-10-05", mortality: 0, feedUsedKg: 60, eggsCollected: 0, feedTypeId: feedId }),
    }),
    request("/api/daily-records", {
      method: "POST", headers: h,
      body: JSON.stringify({ houseId, date: "2026-10-06", mortality: 0, feedUsedKg: 60, eggsCollected: 0, feedTypeId: feedId }),
    }),
  ]);
  const okCount = [c1, c2].filter((r) => r.status === 201).length;
  assert.equal(okCount, 1);
  assert.ok([400, 409].includes([c1, c2].find((r) => r.status !== 201).status));
  assert.equal(await stockOf(feedId, h), 20);

  // TEST 3: edit recent record 150 -> 120, single consistent movement.
  const edit = await request(`/api/daily-records/${rec1.body.data.id}`, {
    method: "PUT",
    headers: h,
    body: JSON.stringify({ mortality: 0, feedUsedKg: 120, eggsCollected: 10, feedTypeId: feedId }),
  });
  assert.equal(edit.status, 200);
  assert.equal(edit.body.inventory.stockAfter, 50);
  assert.equal(await stockOf(feedId, h), 50);
  const movesAfterEdit = await request(
    `/api/inventory/movements?feedTypeId=${feedId}&type=CONSUMPTION`, { headers: h }
  );
  const recMoves = movesAfterEdit.body.data.movements.filter((m) => m.dailyRecordId === rec1.body.data.id);
  assert.equal(recMoves.length, 1);
  assert.equal(recMoves[0].quantity, -120);
  assert.equal(recMoves[0].balanceAfter, 50);

  // TEST 4: aged record is immutable; reversal entry corrects the effect.
  await prisma.dailyRecord.update({
    where: { id: rec1.body.data.id },
    data: { createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
  });
  const editOld = await request(`/api/daily-records/${rec1.body.data.id}`, {
    method: "PUT",
    headers: h,
    body: JSON.stringify({ mortality: 0, feedUsedKg: 100, eggsCollected: 10, feedTypeId: feedId }),
  });
  assert.equal(editOld.status, 403);
  const delOld = await request(`/api/daily-records/${rec1.body.data.id}`, {
    method: "DELETE", headers: h,
  });
  assert.equal(delOld.status, 403);
  const unchanged = await request(`/api/daily-records/${rec1.body.data.id}`, { headers: h });
  assert.equal(unchanged.status, 200);
  assert.equal(unchanged.body.data.feedUsedKg, 120);
  assert.equal(await stockOf(feedId, h), 50);
  const reversal = await request("/api/inventory/adjust", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      feedTypeId: feedId, type: "ADJUSTMENT", quantity: 30,
      reason: `Correction for Daily Record #${rec1.body.data.id}`,
    }),
  });
  assert.equal(reversal.status, 201);
  assert.equal(await stockOf(feedId, h), 80);

  // TEST 10: duplicate feed type prevented; repeat purchases accumulate.
  const dup1 = await request("/api/feed-types", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ name: "DC Dup Feed", unit: "kg", minimumStock: 0, currentStock: 0, unitCost: 5 }),
  });
  assert.equal(dup1.status, 201);
  const dup2 = await request("/api/feed-types", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ name: "dc dup feed", unit: "kg", minimumStock: 0, currentStock: 0, unitCost: 5 }),
  });
  assert.equal(dup2.status, 409);
  const dupFeedId = dup1.body.data.id;
  for (const qty of [10, 15]) {
    const p = await request("/api/expenses", {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        feedTypeId: dupFeedId, category: "Feed", quantity: qty, unit: "kg",
        unitPrice: 5, date: new Date().toISOString(),
      }),
    });
    assert.equal(p.status, 201);
  }
  assert.equal(await stockOf(dupFeedId, h), 25);
  const allFeeds = await request("/api/feed-types", { headers: h });
  assert.equal(allFeeds.body.data.filter((f) => f.name.toLowerCase() === "dc dup feed").length, 1);
});
