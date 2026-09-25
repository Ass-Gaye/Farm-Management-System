const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const prisma = require("../src/lib/prisma");
const { app } = require("../src/server");

const email = "finance_inventory_link@example.com";
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

before(async () => {
  await prisma.user.deleteMany({ where: { email } });
  await new Promise((r) => {
    server = app.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`;
      r();
    });
  });
});
after(async () => {
  await prisma.user.deleteMany({ where: { email } });
  if (server) await new Promise((res, rej) => server.close((e) => (e ? rej(e) : res())));
  await prisma.$disconnect();
});

test("expense responses carry their inventory effect", async () => {
  const reg = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password: "password123", name: "Link Check" }),
  });
  assert.equal(reg.status, 201);
  const h = { Authorization: `Bearer ${reg.body.data.token}` };

  const feed = await request("/api/feed-types", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ name: "Link Feed", unit: "kg", currentStock: 0 }),
  });
  assert.equal(feed.status, 201);
  const feedId = feed.body.data.id;

  // Create: inventory block present, movement linked to the expense.
  const created = await request("/api/expenses", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      feedTypeId: feedId, category: "Feed", quantity: 40, unit: "kg",
      unitPrice: 10, date: new Date().toISOString(), description: "Link buy",
    }),
  });
  assert.equal(created.status, 201);
  assert.ok(created.body.inventory);
  assert.equal(created.body.inventory.feedName, "Link Feed");
  assert.equal(created.body.inventory.purchaseQty, 40);
  assert.equal(created.body.inventory.stockBefore, 0);
  assert.equal(created.body.inventory.stockAfter, 40);
  const expenseId = created.body.data.id;

  const detail = await request(`/api/expenses/${expenseId}`, { headers: h });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.inventoryMovements.length, 1);
  assert.equal(detail.body.data.inventoryMovements[0].type, "PURCHASE");
  assert.equal(detail.body.data.inventoryMovements[0].quantity, 40);
  assert.equal(detail.body.data.inventoryMovements[0].balanceAfter, 40);

  // Non-feed expense: no inventory block.
  const general = await request("/api/expenses", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ category: "Electricity", amount: 100, date: new Date().toISOString() }),
  });
  assert.equal(general.status, 201);
  assert.equal(general.body.inventory, null);

  // Update: inventory block reflects the new purchase effect.
  const updated = await request(`/api/expenses/${expenseId}`, {
    method: "PUT",
    headers: h,
    body: JSON.stringify({
      category: "Feed", quantity: 25, unit: "kg", unitPrice: 10,
      amount: 250, date: new Date().toISOString(),
    }),
  });
  assert.equal(updated.status, 200);
  assert.ok(updated.body.inventory);
  assert.equal(updated.body.inventory.purchaseQty, 25);
  assert.equal(updated.body.inventory.stockBefore, 0);
  assert.equal(updated.body.inventory.stockAfter, 25);

  // Delete: inventory block reports the reversal.
  const deleted = await request(`/api/expenses/${expenseId}`, { method: "DELETE", headers: h });
  assert.equal(deleted.status, 200);
  assert.ok(deleted.body.inventory);
  assert.equal(deleted.body.inventory.reversedQty, 25);
  assert.equal(deleted.body.inventory.stockBefore, 25);
  assert.equal(deleted.body.inventory.stockAfter, 0);
});

test("recorded purchase feed and unit are locked on update", async () => {
  const login = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: "password123" }),
  });
  assert.equal(login.status, 200);
  const h = { Authorization: `Bearer ${login.body.data.token}` };

  const feed = await request("/api/feed-types", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ name: "Lock Bags", unit: "bags", bagWeightKg: 50, currentStock: 0 }),
  });
  assert.equal(feed.status, 201);
  const other = await request("/api/feed-types", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ name: "Lock Other", unit: "kg", currentStock: 0 }),
  });
  assert.equal(other.status, 201);

  const purchase = await request("/api/expenses", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      feedTypeId: feed.body.data.id, category: "Feed", quantity: 2, unit: "bags",
      unitPrice: 1000, date: new Date().toISOString(),
    }),
  });
  assert.equal(purchase.status, 201);
  const purchaseId = purchase.body.data.id;

  // Unit reinterpretation rejected, stock and expense unchanged.
  const unitChange = await request(`/api/expenses/${purchaseId}`, {
    method: "PUT",
    headers: h,
    body: JSON.stringify({ category: "Feed", quantity: 2, unit: "kg", unitPrice: 1000, amount: 2000, date: new Date().toISOString() }),
  });
  assert.equal(unitChange.status, 400);
  assert.ok(unitChange.body.message.toLowerCase().includes("cannot be changed"));
  const feedAfter = await request(`/api/feed-types/${feed.body.data.id}`, { headers: h });
  assert.equal(feedAfter.body.data.currentStock, 2);
  const expAfter = await request(`/api/expenses/${purchaseId}`, { headers: h });
  assert.equal(expAfter.body.data.unit, "bags");

  // Feed switch rejected as well.
  const feedChange = await request(`/api/expenses/${purchaseId}`, {
    method: "PUT",
    headers: h,
    body: JSON.stringify({ category: "Feed", feedTypeId: other.body.data.id, quantity: 2, unit: "bags", unitPrice: 1000, amount: 2000, date: new Date().toISOString() }),
  });
  assert.equal(feedChange.status, 400);

  // Quantity-only correction still allowed: 2 -> 3 bags.
  const qtyFix = await request(`/api/expenses/${purchaseId}`, {
    method: "PUT",
    headers: h,
    body: JSON.stringify({ category: "Feed", quantity: 3, unit: "bags", unitPrice: 1000, amount: 3000, date: new Date().toISOString() }),
  });
  assert.equal(qtyFix.status, 200);
  const feedFinal = await request(`/api/feed-types/${feed.body.data.id}`, { headers: h });
  assert.equal(feedFinal.body.data.currentStock, 3);
});
