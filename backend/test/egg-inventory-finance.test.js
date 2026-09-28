const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");

const prisma = require("../src/lib/prisma");
const { app } = require("../src/server");

const testUserEmail = "eggs_finance_test@example.com";
const intruderUserEmail = "eggs_finance_intruder@example.com";
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

const getStock = async (auth) => {
  const res = await request("/api/eggs/inventory", { method: "GET", headers: auth });
  assert.equal(res.status, 200);
  return res.body.data;
};

test("Phase 4.2: Egg Inventory + Egg Sales -> Finance Integration", async () => {
  const reg1 = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: testUserEmail, password: "password123", name: "Egg Farmer" }),
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
      name: "Layer House E1",
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
      name: "Layers Batch L-26",
      batchNumber: "L-2026-01",
      purpose: "LAYER",
      birdsPlaced: 500,
      placementDate: "2026-08-01T00:00:00.000Z",
    }),
  });
  assert.equal(flockRes.status, 201);
  const flockId = flockRes.body.data.id;

  const custRes = await request("/api/customers", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ name: "Egg Retailer", phone: "+220 9988776" }),
  });
  assert.equal(custRes.status, 201);
  const customerId = custRes.body.data.id;

  const cust2Res = await request("/api/customers", {
    method: "POST",
    headers: auth2,
    body: JSON.stringify({ name: "Intruder Customer" }),
  });
  assert.equal(cust2Res.status, 201);
  const intruderCustomerId = cust2Res.body.data.id;

  // --- 1. DailyRecord creation adds egg stock ---
  const r1 = await request("/api/daily-records", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      houseId,
      flockId,
      date: "2026-09-01T00:00:00.000Z",
      mortality: 2,
      feedUsedKg: 0,
      eggsCollected: 120,
    }),
  });
  assert.equal(r1.status, 201, `R1 failed: ${JSON.stringify(r1.body)}`);
  assert.equal(r1.body.eggInventory.collectedEggs, 120);
  const record1Id = r1.body.data.id;
  assert.equal((await getStock(auth1)).currentStock, 120);

  // --- 2. Second record adds correctly ---
  const r2 = await request("/api/daily-records", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      houseId,
      flockId,
      date: "2026-09-02T00:00:00.000Z",
      mortality: 1,
      feedUsedKg: 0,
      eggsCollected: 80,
    }),
  });
  assert.equal(r2.status, 201);
  const record2Id = r2.body.data.id;
  assert.equal((await getStock(auth1)).currentStock, 200);

  // --- 3. Update applies only the delta (120 -> 150 = +30) ---
  const u1 = await request(`/api/daily-records/${record1Id}`, {
    method: "PUT",
    headers: auth1,
    body: JSON.stringify({ eggsCollected: 150 }),
  });
  assert.equal(u1.status, 200);
  assert.equal((await getStock(auth1)).currentStock, 230);
  const prodMovements = await prisma.eggMovement.count({
    where: { dailyRecordId: record1Id, type: "PRODUCTION" },
  });
  assert.equal(prodMovements, 1);

  // --- 4. Reducing applies negative delta (150 -> 100 = -50) ---
  const u2 = await request(`/api/daily-records/${record1Id}`, {
    method: "PUT",
    headers: auth1,
    body: JSON.stringify({ eggsCollected: 100 }),
  });
  assert.equal(u2.status, 200);
  assert.equal((await getStock(auth1)).currentStock, 180);

  // --- 5. Delete reverses contribution ---
  const d2 = await request(`/api/daily-records/${record2Id}`, {
    method: "DELETE",
    headers: auth1,
  });
  assert.equal(d2.status, 200);
  assert.equal((await getStock(auth1)).currentStock, 100);

  // --- 6/7/8. Fully paid egg sale: 40 eggs x 15 GMD = 600 ---
  const s1 = await request("/api/eggs/sales", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      houseId,
      flockId,
      customerId,
      quantity: 40,
      unitPrice: 15,
      amountPaid: 600,
      date: "2026-09-20T00:00:00.000Z",
      notes: "Sold to Egg Retailer",
    }),
  });
  assert.equal(s1.status, 201, `Sale1 failed: ${JSON.stringify(s1.body)}`);
  assert.equal(s1.body.data.stockAfter, 60);
  const sale1Id = s1.body.data.id;
  const income1Id = s1.body.data.incomeId;
  assert.ok(income1Id);

  const income1 = await prisma.income.findUnique({ where: { id: income1Id } });
  assert.equal(Number(income1.amount), 600);
  assert.equal(Number(income1.amountPaid), 600);
  assert.equal(Number(income1.amountDue), 0);
  assert.equal(income1.paymentStatus, "PAID");
  assert.equal(income1.category, "Egg sales");
  assert.equal(income1.unit, "pieces");
  assert.equal(Number(income1.quantity), 40);
  assert.equal(Number(income1.unitPrice), 15);
  assert.equal(income1.customerId, customerId);
  assert.equal(income1.houseId, houseId);
  assert.equal(income1.flockId, flockId);
  assert.equal((await getStock(auth1)).currentStock, 60);

  // --- Partial payment: 20 x 20 = 400, paid 100 ---
  const s2 = await request("/api/eggs/sales", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      houseId,
      flockId,
      customerId,
      quantity: 20,
      unitPrice: 20,
      amountPaid: 100,
      date: "2026-09-21T00:00:00.000Z",
    }),
  });
  assert.equal(s2.status, 201);
  const income2 = await prisma.income.findUnique({ where: { id: s2.body.data.incomeId } });
  assert.equal(Number(income2.amount), 400);
  assert.equal(Number(income2.amountPaid), 100);
  assert.equal(Number(income2.amountDue), 300);
  assert.equal(income2.paymentStatus, "PARTIALLY_PAID");
  assert.equal((await getStock(auth1)).currentStock, 40);

  // --- Unpaid: 10 x 10 = 100, paid 0 ---
  const s3 = await request("/api/eggs/sales", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      houseId,
      quantity: 10,
      unitPrice: 10,
      amountPaid: 0,
      date: "2026-09-22T00:00:00.000Z",
    }),
  });
  assert.equal(s3.status, 201);
  const sale3Id = s3.body.data.id;
  const income3Id = s3.body.data.incomeId;
  const income3 = await prisma.income.findUnique({ where: { id: income3Id } });
  assert.equal(income3.paymentStatus, "UNPAID");
  assert.equal((await getStock(auth1)).currentStock, 30);

  // --- 5 (negative stock rejected) ---
  const over = await request("/api/eggs/sales", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ houseId, quantity: 31, unitPrice: 10, date: "2026-09-22T00:00:00.000Z" }),
  });
  assert.equal(over.status, 400);
  assert.equal((await getStock(auth1)).currentStock, 30);

  // --- 11a. Repeated identical update is idempotent ---
  const incomeCountBefore = await prisma.income.count({ where: { userId: reg1.body.data.user.id } });
  const rep1 = await request(`/api/eggs/sales/${sale1Id}`, {
    method: "PUT",
    headers: auth1,
    body: JSON.stringify({ quantity: 40, unitPrice: 15, amount: 600, amountPaid: 600 }),
  });
  assert.equal(rep1.status, 200);
  assert.equal(rep1.body.data.incomeId, income1Id);
  assert.equal((await getStock(auth1)).currentStock, 30);
  const incomeCountAfter = await prisma.income.count({ where: { userId: reg1.body.data.user.id } });
  assert.equal(incomeCountAfter, incomeCountBefore);

  // --- 11b. Linking an existing income creates no duplicate ---
  const link = await request("/api/eggs/sales", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      houseId,
      quantity: 5,
      date: "2026-09-23T00:00:00.000Z",
      incomeId: income1Id,
    }),
  });
  assert.equal(link.status, 201);
  assert.equal(link.body.data.incomeId, income1Id);
  assert.equal((await getStock(auth1)).currentStock, 25);

  // --- 9. Update grows sale (40 -> 50): stock -10, same income ---
  const up1 = await request(`/api/eggs/sales/${sale1Id}`, {
    method: "PUT",
    headers: auth1,
    body: JSON.stringify({ quantity: 50, unitPrice: 15, amountPaid: 750 }),
  });
  assert.equal(up1.status, 200);
  assert.equal(up1.body.data.incomeId, income1Id);
  assert.equal(up1.body.data.stockAfter, 15);
  const income1b = await prisma.income.findUnique({ where: { id: income1Id } });
  assert.equal(Number(income1b.amount), 750);
  assert.equal(Number(income1b.quantity), 50);

  // --- 9b. Update shrinks sale (50 -> 30): stock +20 ---
  const up2 = await request(`/api/eggs/sales/${sale1Id}`, {
    method: "PUT",
    headers: auth1,
    body: JSON.stringify({ quantity: 30, unitPrice: 15, amountPaid: 450 }),
  });
  assert.equal(up2.status, 200);
  assert.equal(up2.body.data.stockAfter, 35);
  const income1c = await prisma.income.findUnique({ where: { id: income1Id } });
  assert.equal(Number(income1c.amount), 450);

  // --- 10. Delete restores stock + removes owned income ---
  const del3 = await request(`/api/eggs/sales/${sale3Id}`, {
    method: "DELETE",
    headers: auth1,
  });
  assert.equal(del3.status, 200);
  assert.equal(del3.body.data.stockAfter, 45);
  assert.equal(await prisma.income.findUnique({ where: { id: income3Id } }), null);

  // --- 12. Cross-user protection ---
  const crossCust = await request("/api/eggs/sales", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ houseId, quantity: 2, unitPrice: 10, customerId: intruderCustomerId, date: "2026-09-24T00:00:00.000Z" }),
  });
  assert.equal(crossCust.status, 404);

  const crossUpdate = await request(`/api/eggs/sales/${sale1Id}`, {
    method: "PUT",
    headers: auth2,
    body: JSON.stringify({ quantity: 5 }),
  });
  assert.equal(crossUpdate.status, 404);

  const crossDelete = await request(`/api/eggs/sales/${sale1Id}`, {
    method: "DELETE",
    headers: auth2,
  });
  assert.equal(crossDelete.status, 404);

  const intruderSales = await request("/api/eggs/sales", { method: "GET", headers: auth2 });
  assert.equal(intruderSales.status, 200);
  assert.equal(intruderSales.body.data.length, 0);
  assert.equal((await getStock(auth2)).currentStock, 0);

  // --- 13. Manual adjustments: wastage, return, over-adjust rejected ---
  const incomesBeforeAdj = await prisma.income.count({ where: { userId: reg1.body.data.user.id } });
  const wast = await request("/api/eggs/adjust", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ type: "WASTAGE", quantity: -5, reason: "Breakage" }),
  });
  assert.equal(wast.status, 201);
  assert.equal(wast.body.data.stockAfter, 40);

  const ret = await request("/api/eggs/adjust", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ type: "RETURN", quantity: 3, reason: "Customer return" }),
  });
  assert.equal(ret.status, 201);
  assert.equal(ret.body.data.stockAfter, 43);

  const overAdj = await request("/api/eggs/adjust", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ type: "WASTAGE", quantity: -44, reason: "Too much" }),
  });
  assert.equal(overAdj.status, 400);
  assert.equal((await getStock(auth1)).currentStock, 43);
  assert.equal(await prisma.income.count({ where: { userId: reg1.body.data.user.id } }), incomesBeforeAdj);

  const badType = await request("/api/eggs/adjust", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ type: "SALE", quantity: -2 }),
  });
  assert.equal(badType.status, 400);

  // --- 4. Out-of-window EGGS correction moves stock by delta ---
  await prisma.dailyRecord.update({
    where: { id: record1Id },
    data: { createdAt: new Date(Date.now() - 30 * 864e5) },
  });
  const corr1 = await request(`/api/daily-records/${record1Id}/corrections`, {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ field: "EGGS", correctedValue: 130, reason: "Recount showed more eggs" }),
  });
  assert.equal(corr1.status, 201, `Correction failed: ${JSON.stringify(corr1.body)}`);
  assert.equal(Number(corr1.body.data.adjustment), 30);
  assert.equal((await getStock(auth1)).currentStock, 73);

  // Correction that would drive stock negative is rejected
  // (stock 73, delta -80 would reach -7)
  const corrBad = await request(`/api/daily-records/${record1Id}/corrections`, {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ field: "EGGS", correctedValue: 50, reason: "Too few" }),
  });
  assert.equal(corrBad.status, 400);
  assert.equal((await getStock(auth1)).currentStock, 73);

  const corr2 = await request(`/api/daily-records/${record1Id}/corrections`, {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({ field: "EGGS", correctedValue: 60, reason: "Spoiled batch excluded" }),
  });
  assert.equal(corr2.status, 201);
  assert.equal((await getStock(auth1)).currentStock, 3);

  // --- Finance reflects egg sales ---
  const summary = await request("/api/finances/summary", { method: "GET", headers: auth1 });
  assert.equal(summary.status, 200);
  assert.equal(summary.body.data.eggSalesTotal, 850); // 450 + 400
  assert.equal(summary.body.data.totalCustomerOutstanding, 300);

  const txRes = await request("/api/finances/transactions?type=income", { method: "GET", headers: auth1 });
  assert.equal(txRes.status, 200);
  const eggInTx = txRes.body.data.filter((t) => t.category === "Egg sales");
  assert.equal(eggInTx.length, 2);

  // --- 15. Phase 4.1 bird sales still work alongside ---
  const birdSale = await request("/api/depopulation-events", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      flockId,
      quantity: 10,
      reason: "SOLD",
      date: "2026-09-25T00:00:00.000Z",
      unitPrice: 350,
      amount: 3500,
      customerId,
      amountPaid: 3500,
    }),
  });
  assert.equal(birdSale.status, 201, `Bird sale failed: ${JSON.stringify(birdSale.body)}`);
  const birdIncome = await prisma.income.findUnique({ where: { id: birdSale.body.data.incomeId } });
  assert.equal(birdIncome.category, "Bird sales");
  assert.equal(Number(birdIncome.amount), 3500);
});
