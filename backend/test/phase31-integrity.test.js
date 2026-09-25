const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");

const prisma = require("../src/lib/prisma");
const { app } = require("../src/server");

const email1 = "phase31_user1@example.com";
const email2 = "phase31_user2@example.com";
const houseName = "__phase31_house__";
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
  await prisma.user.deleteMany({ where: { email: { in: [email1, email2] } } });
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

test("Phase 3.1 integrity: F8/F6/F16/F10/F20 guards", async () => {
  const reg1 = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: email1, password: "password123", name: "P31 A" }),
  });
  assert.equal(reg1.status, 201);
  const h1 = { Authorization: `Bearer ${reg1.body.data.token}` };

  const reg2 = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: email2, password: "password456", name: "P31 B" }),
  });
  assert.equal(reg2.status, 201);
  const h2 = { Authorization: `Bearer ${reg2.body.data.token}` };

  const house = await request("/api/houses", {
    method: "POST",
    headers: h1,
    body: JSON.stringify({ name: houseName, address: "Test Town", birdsPlaced: 500, createdAt: "2026-09-01" }),
  });
  assert.equal(house.status, 201);
  const houseId = house.body.data.id;

  // ---------- F8: purchase reversal guards ----------
  const feed = await request("/api/feed-types", {
    method: "POST",
    headers: h1,
    body: JSON.stringify({ name: "P31 Integrity Feed", unit: "kg", minimumStock: 0, currentStock: 0, unitCost: 10 }),
  });
  assert.equal(feed.status, 201);
  const feedId = feed.body.data.id;

  const purchase = await request("/api/expenses", {
    method: "POST",
    headers: h1,
    body: JSON.stringify({
      feedTypeId: feedId, category: "Feed", quantity: 100, unit: "kg",
      unitPrice: 10, date: new Date().toISOString(), description: "P31 purchase",
    }),
  });
  assert.equal(purchase.status, 201);
  const purchaseId = purchase.body.data.id;

  const rec = await request("/api/daily-records", {
    method: "POST",
    headers: h1,
    body: JSON.stringify({
      houseId, date: "2026-08-01", mortality: 0,
      feedUsedKg: 90, eggsCollected: 0, feedTypeId: feedId,
    }),
  });
  assert.equal(rec.status, 201);

  // Unsafe delete: 10 - 100 < 0 -> rejected, everything unchanged.
  const unsafeDel = await request(`/api/expenses/${purchaseId}`, { method: "DELETE", headers: h1 });
  assert.equal(unsafeDel.status, 400);
  assert.ok(unsafeDel.body.message.toLowerCase().includes("negative"));
  const stockAfterBlocked = await request(`/api/feed-types/${feedId}`, { headers: h1 });
  assert.equal(stockAfterBlocked.body.data.currentStock, 10);
  const stillThere = await request(`/api/expenses/${purchaseId}`, { headers: h1 });
  assert.equal(stillThere.status, 200);
  const movesAfterBlocked = await request(
    `/api/inventory/movements?feedTypeId=${feedId}&limit=100`, { headers: h1 }
  );
  const purchaseMoves = movesAfterBlocked.body.data.movements.filter((m) => m.type === "PURCHASE");
  assert.equal(purchaseMoves.length, 1);

  // Unsafe update: 100 -> 20 requires reverting 100 from stock 10 -> rejected.
  const unsafeUpd = await request(`/api/expenses/${purchaseId}`, {
    method: "PUT",
    headers: h1,
    body: JSON.stringify({ category: "Feed", quantity: 20, unit: "kg", unitPrice: 10, amount: 200, date: new Date().toISOString() }),
  });
  assert.equal(unsafeUpd.status, 400);
  const afterFailedUpd = await request(`/api/expenses/${purchaseId}`, { headers: h1 });
  assert.equal(Number(afterFailedUpd.body.data.quantity), 100);

  // Safe delete after covering stock: +90 -> 100, delete -> 0.
  const topUp = await request("/api/inventory/adjust", {
    method: "POST",
    headers: h1,
    body: JSON.stringify({ feedTypeId: feedId, type: "ADJUSTMENT", quantity: 90, reason: "P31 cover" }),
  });
  assert.equal(topUp.status, 201);
  const safeDel = await request(`/api/expenses/${purchaseId}`, { method: "DELETE", headers: h1 });
  assert.equal(safeDel.status, 200);
  const stockAfterSafe = await request(`/api/feed-types/${feedId}`, { headers: h1 });
  assert.equal(stockAfterSafe.body.data.currentStock, 0);

  // Safe update path on a fresh purchase.
  const purchase2 = await request("/api/expenses", {
    method: "POST",
    headers: h1,
    body: JSON.stringify({
      feedTypeId: feedId, category: "Feed", quantity: 50, unit: "kg",
      unitPrice: 10, date: new Date().toISOString(), description: "P31 purchase 2",
    }),
  });
  assert.equal(purchase2.status, 201);
  const safeUpd = await request(`/api/expenses/${purchase2.body.data.id}`, {
    method: "PUT",
    headers: h1,
    body: JSON.stringify({ category: "Feed", quantity: 30, unit: "kg", unitPrice: 10, amount: 300, date: new Date().toISOString() }),
  });
  assert.equal(safeUpd.status, 200);
  const stockAfterUpd = await request(`/api/feed-types/${feedId}`, { headers: h1 });
  assert.equal(stockAfterUpd.body.data.currentStock, 30);

  // ---------- F10: manual movement types (controller level) ----------
  for (const bad of ["PURCHASE", "CONSUMPTION"]) {
    const r = await request("/api/inventory/adjust", {
      method: "POST",
      headers: h1,
      body: JSON.stringify({ feedTypeId: feedId, type: bad, quantity: 5, reason: "P31 forged" }),
    });
    assert.equal(r.status, 400, `${bad} must be rejected by the manual endpoint`);
  }
  for (const good of ["ADJUSTMENT", "WASTAGE", "RETURN"]) {
    const r = await request("/api/inventory/adjust", {
      method: "POST",
      headers: h1,
      body: JSON.stringify({ feedTypeId: feedId, type: good, quantity: 1, reason: "P31 legit" }),
    });
    assert.equal(r.status, 201, `${good} must be accepted`);
  }

  // ---------- F6: flock deletion protection ----------
  const mkFlock = async (name) => {
    const r = await request("/api/flocks", {
      method: "POST",
      headers: h1,
      body: JSON.stringify({ houseId, name, birdsPlaced: 100, placementDate: "2026-08-01" }),
    });
    assert.equal(r.status, 201);
    return r.body.data.id;
  };
  const emptyFlock = await mkFlock("P31 Empty");
  const delEmpty = await request(`/api/flocks/${emptyFlock}`, { method: "DELETE", headers: h1 });
  assert.equal(delEmpty.status, 200);

  const histFlock = await mkFlock("P31 History");
  const histRec = await request("/api/daily-records", {
    method: "POST",
    headers: h1,
    body: JSON.stringify({
      houseId, flockId: histFlock, date: "2026-08-02", mortality: 1,
      feedUsedKg: 0, eggsCollected: 5,
    }),
  });
  assert.equal(histRec.status, 201);
  const delHist = await request(`/api/flocks/${histFlock}`, { method: "DELETE", headers: h1 });
  assert.equal(delHist.status, 400);
  assert.ok(delHist.body.message.toLowerCase().includes("historical"));
  // History preserved: flock + record intact.
  const flockStillThere = await request(`/api/flocks/${histFlock}`, { headers: h1 });
  assert.equal(flockStillThere.status, 200);
  const recStillThere = await request(`/api/daily-records/${histRec.body.data.id}`, { headers: h1 });
  assert.equal(recStillThere.status, 200);

  const depFlock = await mkFlock("P31 Depop");
  const depEv = await request("/api/depopulation-events", {
    method: "POST",
    headers: h1,
    body: JSON.stringify({ flockId: depFlock, quantity: 5, reason: "SOLD", date: "2026-08-03" }),
  });
  assert.equal(depEv.status, 201);
  const delDepFlock = await request(`/api/flocks/${depFlock}`, { method: "DELETE", headers: h1 });
  assert.equal(delDepFlock.status, 400);

  // Cross-user delete rejected without leaking existence.
  const crossDel = await request(`/api/flocks/${histFlock}`, { method: "DELETE", headers: h2 });
  assert.equal(crossDel.status, 404);

  // ---------- F16: customer debt protection ----------
  const cust = await request("/api/customers", {
    method: "POST",
    headers: h1,
    body: JSON.stringify({ name: "P31 Customer" }),
  });
  assert.equal(cust.status, 201);
  const custId = cust.body.data.id;
  const creditSale = await request("/api/income", {
    method: "POST",
    headers: h1,
    body: JSON.stringify({
      customerId: custId, category: "Egg sales", quantity: 10, unit: "trays",
      unitPrice: 100, amount: 1000, amountPaid: 400, date: "2026-08-04",
    }),
  });
  assert.equal(creditSale.status, 201);
  const delIndebted = await request(`/api/customers/${custId}`, { method: "DELETE", headers: h1 });
  assert.equal(delIndebted.status, 400);
  assert.ok(delIndebted.body.message.toLowerCase().includes("outstanding"));
  const custStillThere = await request(`/api/customers/${custId}`, { headers: h1 });
  assert.equal(custStillThere.status, 200);
  // Settle then delete succeeds (existing behavior).
  const settle = await request(`/api/income/${creditSale.body.data.id}`, {
    method: "PUT",
    headers: h1,
    body: JSON.stringify({ category: "Egg sales", amount: 1000, amountPaid: 1000, date: "2026-08-04" }),
  });
  assert.equal(settle.status, 200);
  const delSettled = await request(`/api/customers/${custId}`, { method: "DELETE", headers: h1 });
  assert.equal(delSettled.status, 200);
  const crossCustDel = await request(`/api/customers/${custId}`, { method: "DELETE", headers: h2 });
  assert.equal(crossCustDel.status, 404);

  // ---------- F20: failed depopulation leaves no partial state ----------
  const beforeFlock = await request(`/api/flocks/${depFlock}`, { headers: h1 });
  const beforeBirds = beforeFlock.body.data.currentBirds;
  const beforeEvents = await request(`/api/depopulation-events?flockId=${depFlock}`, { headers: h1 });
  const beforeCount = beforeEvents.body.data.events.length;
  const overDep = await request("/api/depopulation-events", {
    method: "POST",
    headers: h1,
    body: JSON.stringify({ flockId: depFlock, quantity: 100000, reason: "SOLD", date: "2026-08-05" }),
  });
  assert.equal(overDep.status, 400);
  const afterFlock = await request(`/api/flocks/${depFlock}`, { headers: h1 });
  assert.equal(afterFlock.body.data.currentBirds, beforeBirds);
  const afterEvents = await request(`/api/depopulation-events?flockId=${depFlock}`, { headers: h1 });
  assert.equal(afterEvents.body.data.events.length, beforeCount);

  // Failed depop update leaves event unchanged.
  const overUpd = await request(`/api/depopulation-events/${depEv.body.data.id}`, {
    method: "PUT",
    headers: h1,
    body: JSON.stringify({ quantity: 100000 }),
  });
  assert.equal(overUpd.status, 400);
  const evAfter = await request(`/api/depopulation-events/${depEv.body.data.id}`, { headers: h1 });
  assert.equal(evAfter.body.data.quantity, 5);
});
