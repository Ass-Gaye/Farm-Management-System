const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");

const prisma = require("../src/lib/prisma");
const { app } = require("../src/server");

const testUserEmail = "birds_finance_test@example.com";
const intruderUserEmail = "birds_finance_intruder@example.com";
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

test("Phase 4.1: Bird Sales -> Finance Integration Complete Verification", async () => {
  // 1. Setup User 1 (Farmer)
  const reg1 = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: testUserEmail,
      password: "password123",
      name: "Bird Sales Farmer",
    }),
  });
  assert.equal(reg1.status, 201);
  const token1 = reg1.body.data.token;
  const auth1 = { Authorization: `Bearer ${token1}` };

  // 2. Setup User 2 (Intruder)
  const reg2 = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: intruderUserEmail,
      password: "password123",
      name: "Intruder User",
    }),
  });
  assert.equal(reg2.status, 201);
  const token2 = reg2.body.data.token;
  const auth2 = { Authorization: `Bearer ${token2}` };

  // 3. Create House for User 1
  const houseRes = await request("/api/houses", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      name: "Broiler House B1",
      address: "Brikama, The Gambia",
      birdsPlaced: 1000,
      createdAt: new Date().toISOString(),
    }),
  });
  assert.equal(houseRes.status, 201);
  const houseId = houseRes.body.data.id;

  // 4. Create Flock for User 1 (1000 birds)
  const flockRes = await request("/api/flocks", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      houseId,
      name: "Batch 2026-Broilers",
      batchNumber: "B-2026-01",
      purpose: "BROILER",
      birdsPlaced: 1000,
      placementDate: "2026-08-01T00:00:00.000Z",
    }),
  });
  assert.equal(flockRes.status, 201);
  const flockId = flockRes.body.data.id;
  assert.equal(flockRes.body.data.currentBirds, 1000);

  // 5. Create Customer for User 1
  const custRes = await request("/api/customers", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      name: "Alhagie Bojang",
      phone: "+220 9988776",
      email: "alhagie@example.com",
    }),
  });
  assert.equal(custRes.status, 201);
  const customerId = custRes.body.data.id;

  // 6. Create Customer for User 2 (Intruder's customer)
  const cust2Res = await request("/api/customers", {
    method: "POST",
    headers: auth2,
    body: JSON.stringify({
      name: "Intruder Customer",
      phone: "+220 1122334",
    }),
  });
  assert.equal(cust2Res.status, 201);
  const intruderCustomerId = cust2Res.body.data.id;

  // ============================================================
  // Test 1-8: SOLD event creates Income (Fully Paid)
  // ============================================================
  // Sell 200 birds at 350 GMD each = 70,000 GMD
  const sale1Res = await request("/api/depopulation-events", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      flockId,
      quantity: 200,
      reason: "SOLD",
      date: "2026-09-20T00:00:00.000Z",
      notes: "Wholesale sale to Alhagie Bojang",
      unitPrice: 350,
      amount: 70000,
      customerId,
      amountPaid: 70000,
    }),
  });
  assert.equal(sale1Res.status, 201, `Create failed: ${JSON.stringify(sale1Res.body)}`);
  assert.equal(sale1Res.body.data.quantity, 200);
  assert.equal(sale1Res.body.data.reason, "SOLD");
  assert.equal(sale1Res.body.data.liveBirdsAfter, 800);
  assert.ok(sale1Res.body.data.incomeId, "incomeId should be populated");
  const income1Id = sale1Res.body.data.incomeId;
  const event1Id = sale1Res.body.data.id;

  // Verify Income record in DB
  const income1 = await prisma.income.findUnique({
    where: { id: income1Id },
  });
  assert.ok(income1, "Income record must exist");
  assert.equal(Number(income1.amount), 70000);
  assert.equal(Number(income1.amountPaid), 70000);
  assert.equal(Number(income1.amountDue), 0);
  assert.equal(income1.paymentStatus, "PAID");
  assert.equal(income1.category, "Bird sales");
  assert.equal(income1.houseId, houseId);
  assert.equal(income1.flockId, flockId);
  assert.equal(income1.customerId, customerId);
  assert.equal(income1.unit, "birds");
  assert.equal(Number(income1.quantity), 200);
  assert.equal(Number(income1.unitPrice), 350);

  // Verify Flock.currentBirds resynced
  const flockAfterSale1 = await prisma.flock.findUnique({ where: { id: flockId } });
  assert.equal(flockAfterSale1.currentBirds, 800);

  // ============================================================
  // Test 9: Partially Paid Sale
  // ============================================================
  // Sell 100 birds at 400 GMD = 40,000 GMD, paid 15,000 GMD, due 25,000 GMD
  const sale2Res = await request("/api/depopulation-events", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      flockId,
      quantity: 100,
      reason: "SOLD",
      date: "2026-09-21T00:00:00.000Z",
      unitPrice: 400,
      customerId,
      amountPaid: 15000,
    }),
  });
  assert.equal(sale2Res.status, 201);
  assert.equal(sale2Res.body.data.liveBirdsAfter, 700);
  const income2Id = sale2Res.body.data.incomeId;
  assert.ok(income2Id);

  const income2 = await prisma.income.findUnique({ where: { id: income2Id } });
  assert.equal(Number(income2.amount), 40000);
  assert.equal(Number(income2.amountPaid), 15000);
  assert.equal(Number(income2.amountDue), 25000);
  assert.equal(income2.paymentStatus, "PARTIALLY_PAID");

  // ============================================================
  // Test 10: Unpaid Sale
  // ============================================================
  // Sell 50 birds at 300 GMD = 15,000 GMD, paid 0
  const sale3Res = await request("/api/depopulation-events", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      flockId,
      quantity: 50,
      reason: "SOLD",
      date: "2026-09-22T00:00:00.000Z",
      unitPrice: 300,
      customerId,
      amountPaid: 0,
    }),
  });
  assert.equal(sale3Res.status, 201);
  assert.equal(sale3Res.body.data.liveBirdsAfter, 650);
  const income3Id = sale3Res.body.data.incomeId;

  const income3 = await prisma.income.findUnique({ where: { id: income3Id } });
  assert.equal(Number(income3.amount), 15000);
  assert.equal(Number(income3.amountPaid), 0);
  assert.equal(Number(income3.amountDue), 15000);
  assert.equal(income3.paymentStatus, "UNPAID");

  // Customer debt total check: Alhagie Bojang should owe 25,000 + 15,000 = 40,000 GMD
  const summaryRes = await request("/api/finances/summary", {
    method: "GET",
    headers: auth1,
  });
  assert.equal(summaryRes.status, 200);
  assert.equal(summaryRes.body.data.totalCustomerOutstanding, 40000);
  assert.equal(summaryRes.body.data.birdSalesTotal, 125000); // 70000 + 40000 + 15000

  // ============================================================
  // Test 11: Idempotency / No duplicate Income on creation
  // ============================================================
  const incomeCountBefore = await prisma.income.count({ where: { flockId } });
  assert.equal(incomeCountBefore, 3);

  // If incomeId is passed directly, do not create another Income
  const manualLinkRes = await request("/api/depopulation-events", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      flockId,
      quantity: 10,
      reason: "SOLD",
      date: "2026-09-23T00:00:00.000Z",
      incomeId: income1Id,
    }),
  });
  assert.equal(manualLinkRes.status, 201);
  const incomeCountAfterManual = await prisma.income.count({ where: { flockId } });
  assert.equal(incomeCountAfterManual, 3); // No new Income created!

  // ============================================================
  // Test 12-13: Editing SOLD event updates Income without duplicate
  // ============================================================
  // Edit event1: increase quantity from 200 to 220 at 350 = 77,000 GMD
  const updateEvent1Res = await request(`/api/depopulation-events/${event1Id}`, {
    method: "PUT",
    headers: auth1,
    body: JSON.stringify({
      quantity: 220,
      unitPrice: 350,
      amount: 77000,
      amountPaid: 77000,
    }),
  });
  assert.equal(updateEvent1Res.status, 200);
  assert.equal(updateEvent1Res.body.data.incomeId, income1Id); // same Income record
  const incomeCountAfterUpdate = await prisma.income.count({ where: { flockId } });
  assert.equal(incomeCountAfterUpdate, 3); // Still exactly 3 records, no duplication!

  const updatedIncome1 = await prisma.income.findUnique({ where: { id: income1Id } });
  assert.equal(Number(updatedIncome1.amount), 77000);
  assert.equal(Number(updatedIncome1.quantity), 220);

  // ============================================================
  // Test 14: SOLD -> non-SOLD (e.g. CULLED) cleans up linked Income
  // ============================================================
  // Create a separate SOLD event with auto Income
  const tempSoldRes = await request("/api/depopulation-events", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      flockId,
      quantity: 20,
      reason: "SOLD",
      date: "2026-09-24T00:00:00.000Z",
      unitPrice: 300,
      amount: 6000,
    }),
  });
  assert.equal(tempSoldRes.status, 201);
  const tempEventId = tempSoldRes.body.data.id;
  const tempIncomeId = tempSoldRes.body.data.incomeId;
  assert.ok(tempIncomeId);

  // Change reason from SOLD to CULLED
  const changeToCulledRes = await request(`/api/depopulation-events/${tempEventId}`, {
    method: "PUT",
    headers: auth1,
    body: JSON.stringify({
      reason: "CULLED",
    }),
  });
  assert.equal(changeToCulledRes.status, 200);
  assert.equal(changeToCulledRes.body.data.reason, "CULLED");
  assert.equal(changeToCulledRes.body.data.incomeId, null);

  // Linked income must be deleted
  const deletedTempIncome = await prisma.income.findUnique({ where: { id: tempIncomeId } });
  assert.equal(deletedTempIncome, null, "Income must be cleaned up when event reason changes from SOLD to CULLED");

  // ============================================================
  // Test 15: non-SOLD -> SOLD creates Income
  // ============================================================
  const changeBackToSoldRes = await request(`/api/depopulation-events/${tempEventId}`, {
    method: "PUT",
    headers: auth1,
    body: JSON.stringify({
      reason: "SOLD",
      unitPrice: 350,
      amount: 7000,
    }),
  });
  assert.equal(changeBackToSoldRes.status, 200);
  assert.equal(changeBackToSoldRes.body.data.reason, "SOLD");
  assert.ok(changeBackToSoldRes.body.data.incomeId, "New Income must be created when transitioning to SOLD");
  const recreatedIncomeId = changeBackToSoldRes.body.data.incomeId;
  const recreatedIncome = await prisma.income.findUnique({ where: { id: recreatedIncomeId } });
  assert.ok(recreatedIncome);
  assert.equal(Number(recreatedIncome.amount), 7000);

  // ============================================================
  // Test 16: Deleting SOLD event deletes linked Income safely
  // ============================================================
  const deleteEventRes = await request(`/api/depopulation-events/${tempEventId}`, {
    method: "DELETE",
    headers: auth1,
  });
  assert.equal(deleteEventRes.status, 200);

  // Linked income must be gone
  const incomeAfterDelete = await prisma.income.findUnique({ where: { id: recreatedIncomeId } });
  assert.equal(incomeAfterDelete, null, "Linked Income must be deleted when SOLD event is deleted");

  // ============================================================
  // Test 17: Non-sale depopulation events (CULLED, SLAUGHTERED) create NO Income
  // ============================================================
  const culledRes = await request("/api/depopulation-events", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      flockId,
      quantity: 15,
      reason: "CULLED",
      date: "2026-09-25T00:00:00.000Z",
      notes: "Health cull",
    }),
  });
  assert.equal(culledRes.status, 201);
  assert.equal(culledRes.body.data.incomeId, null);
  assert.equal(culledRes.body.data.income, null);

  const slaughteredRes = await request("/api/depopulation-events", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      flockId,
      quantity: 25,
      reason: "SLAUGHTERED",
      date: "2026-09-25T00:00:00.000Z",
      notes: "Harvest for farm kitchen",
    }),
  });
  assert.equal(slaughteredRes.status, 201);
  assert.equal(slaughteredRes.body.data.incomeId, null);

  // ============================================================
  // Test 18: Cross-User Security / Ownership Checks
  // ============================================================
  // User 2 cannot create a sale on User 1's flock
  const crossFlockSale = await request("/api/depopulation-events", {
    method: "POST",
    headers: auth2,
    body: JSON.stringify({
      flockId,
      quantity: 10,
      reason: "SOLD",
      date: "2026-09-25T00:00:00.000Z",
      unitPrice: 300,
    }),
  });
  assert.equal(crossFlockSale.status, 404);

  // User 1 cannot link User 2's customer
  const crossCustomerSale = await request("/api/depopulation-events", {
    method: "POST",
    headers: auth1,
    body: JSON.stringify({
      flockId,
      quantity: 10,
      reason: "SOLD",
      date: "2026-09-25T00:00:00.000Z",
      customerId: intruderCustomerId,
    }),
  });
  assert.equal(crossCustomerSale.status, 404);

  // User 2 cannot update User 1's event
  const crossUpdate = await request(`/api/depopulation-events/${event1Id}`, {
    method: "PUT",
    headers: auth2,
    body: JSON.stringify({ quantity: 5 }),
  });
  assert.equal(crossUpdate.status, 404);

  // User 2 cannot delete User 1's event
  const crossDelete = await request(`/api/depopulation-events/${event1Id}`, {
    method: "DELETE",
    headers: auth2,
  });
  assert.equal(crossDelete.status, 404);

  // ============================================================
  // Test 19-20: Bird counts and Flock.currentBirds live authority
  // ============================================================
  // Placed: 1000
  // Depopulated:
  // event1: 220 (SOLD)
  // sale2: 100 (SOLD)
  // sale3: 50 (SOLD)
  // manualLink: 10 (SOLD)
  // culled: 15 (CULLED)
  // slaughtered: 25 (SLAUGHTERED)
  // Total depopulated = 220 + 100 + 50 + 10 + 15 + 25 = 420
  // Expected live birds = 1000 - 420 = 580
  const finalFlockCheck = await request(`/api/flocks/${flockId}`, {
    method: "GET",
    headers: auth1,
  });
  assert.equal(finalFlockCheck.status, 200);
  assert.equal(finalFlockCheck.body.data.currentBirds, 580);
  assert.equal(finalFlockCheck.body.data.performance.totalDepopulated, 420);

  const flockInDb = await prisma.flock.findUnique({ where: { id: flockId } });
  assert.equal(flockInDb.currentBirds, 580);

  // Verify created bird sales appear in unified finance transactions
  const transactionsRes = await request("/api/finances/transactions?type=income", {
    method: "GET",
    headers: auth1,
  });
  assert.equal(transactionsRes.status, 200);
  const birdSalesInTx = transactionsRes.body.data.filter((t) => t.category === "Bird sales");
  assert.equal(birdSalesInTx.length, 3); // 77k, 40k, 15k
});
