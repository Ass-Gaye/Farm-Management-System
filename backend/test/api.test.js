const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");

const prisma = require("../src/lib/prisma");
const { app } = require("../src/server");

const testUser1Email = "test_user1@example.com";
const testUser2Email = "test_user2@example.com";
const testHouseName = "__api_test_house__";
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

const cleanupTestData = async () => {
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [testUser1Email, testUser2Email],
      },
    },
  });

  const houses = await prisma.poultryHouse.findMany({
    where: {
      name: testHouseName,
    },
    select: {
      id: true,
    },
  });

  if (houses.length > 0) {
    await prisma.poultryHouse.deleteMany({
      where: {
        id: {
          in: houses.map((house) => house.id),
        },
      },
    });
  }
};

before(async () => {
  await cleanupTestData();

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  await cleanupTestData();
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await prisma.$disconnect();
});

test("supports full authentication, user isolation, and features lifecycle", async () => {
  // 1. Health check
  const health = await request("/api/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.success, true);

  // 2. Unauthenticated access rejected
  const unauthHouses = await request("/api/houses");
  assert.equal(unauthHouses.status, 401);

  // 3. User 1 Registration & Login
  const regUser1 = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: testUser1Email,
      password: "password123",
      name: "Farmer Alice",
    }),
  });
  assert.equal(regUser1.status, 201);
  assert.ok(regUser1.body.data.token);
  assert.equal(regUser1.body.data.user.email, testUser1Email);
  const token1 = regUser1.body.data.token;
  const authHeaders1 = { Authorization: `Bearer ${token1}` };

  // Check /me
  const me = await request("/api/auth/me", { headers: authHeaders1 });
  assert.equal(me.status, 200);
  assert.equal(me.body.data.email, testUser1Email);

  // 4. User 2 Registration
  const regUser2 = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: testUser2Email,
      password: "password456",
      name: "Farmer Bob",
    }),
  });
  assert.equal(regUser2.status, 201);
  const token2 = regUser2.body.data.token;
  const authHeaders2 = { Authorization: `Bearer ${token2}` };

  // 5. User 1 House Management
  const invalidHouse = await request("/api/houses", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      name: "Invalid House",
      birdsPlaced: 0,
      createdAt: "2026-09-10",
    }),
  });
  assert.equal(invalidHouse.status, 400);

  const createdHouse = await request("/api/houses", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      name: testHouseName,
      birdsPlaced: 100,
      createdAt: "2026-09-10",
    }),
  });
  assert.equal(createdHouse.status, 201);
  const houseId = createdHouse.body.data.id;

  // Verify User 1 sees the house
  const user1Houses = await request("/api/houses", { headers: authHeaders1 });
  assert.equal(user1Houses.status, 200);
  assert.equal(user1Houses.body.data.some((h) => h.id === houseId), true);

  // Verify User 2 DOES NOT see User 1's house
  const user2Houses = await request("/api/houses", { headers: authHeaders2 });
  assert.equal(user2Houses.status, 200);
  assert.equal(user2Houses.body.data.some((h) => h.id === houseId), false);

  // Verify User 2 cannot access, edit, or delete User 1's house
  const user2GetHouse = await request(`/api/houses/${houseId}`, { headers: authHeaders2 });
  assert.equal(user2GetHouse.status, 404);

  const user2UpdateHouse = await request(`/api/houses/${houseId}`, {
    method: "PUT",
    headers: authHeaders2,
    body: JSON.stringify({
      name: "Hacked House",
      birdsPlaced: 200,
      createdAt: "2026-09-10",
    }),
  });
  assert.equal(user2UpdateHouse.status, 404);

  const user2DeleteHouse = await request(`/api/houses/${houseId}`, {
    method: "DELETE",
    headers: authHeaders2,
  });
  assert.equal(user2DeleteHouse.status, 404);

  // 6. Daily Records Lifecycle & Validation
  const createdRecord = await request("/api/daily-records", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      houseId,
      date: "2026-09-10",
      mortality: 5,
      feedUsedKg: 12.5,
      eggsCollected: 40,
    }),
  });
  assert.equal(createdRecord.status, 201);
  const recordId = createdRecord.body.data.id;

  // Duplicate date rejected
  const duplicateRecord = await request("/api/daily-records", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      houseId,
      date: "2026-09-10",
      mortality: 1,
      feedUsedKg: 5,
      eggsCollected: 20,
    }),
  });
  assert.equal(duplicateRecord.status, 409);

  // Excessive mortality rejected
  const excessiveMortality = await request("/api/daily-records", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      houseId,
      date: "2026-09-11",
      mortality: 96,
      feedUsedKg: 10,
      eggsCollected: 30,
    }),
  });
  assert.equal(excessiveMortality.status, 400);

  // User 2 cannot create record in User 1's house
  const user2CreateRecord = await request("/api/daily-records", {
    method: "POST",
    headers: authHeaders2,
    body: JSON.stringify({
      houseId,
      date: "2026-09-12",
      mortality: 1,
      feedUsedKg: 5,
      eggsCollected: 10,
    }),
  });
  assert.equal(user2CreateRecord.status, 404);

  // Update record
  const updatedRecord = await request(`/api/daily-records/${recordId}`, {
    method: "PUT",
    headers: authHeaders1,
    body: JSON.stringify({
      date: "2026-09-10",
      mortality: 3,
      feedUsedKg: 13.5,
      eggsCollected: 45,
    }),
  });
  assert.equal(updatedRecord.status, 200);
  assert.equal(updatedRecord.body.data.mortality, 3);

  // 7. Breed Management
  // Invalid breed (missing name)
  const invalidBreed = await request("/api/breeds", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      houseId,
      name: "",
      numberOfBirds: 50,
    }),
  });
  assert.equal(invalidBreed.status, 400);

  // Valid breed
  const createdBreed = await request("/api/breeds", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      houseId,
      name: "Broiler Cobb 500",
      description: "Fast-growing meat bird",
      numberOfBirds: 50,
      dateAdded: "2026-09-10",
    }),
  });
  assert.equal(createdBreed.status, 201);
  const breedId = createdBreed.body.data.id;
  assert.equal(createdBreed.body.data.name, "Broiler Cobb 500");

  // User 2 cannot view or edit User 1's breed
  const user2GetBreed = await request(`/api/breeds/${breedId}`, { headers: authHeaders2 });
  assert.equal(user2GetBreed.status, 404);

  // Update breed
  const updatedBreed = await request(`/api/breeds/${breedId}`, {
    method: "PUT",
    headers: authHeaders1,
    body: JSON.stringify({
      name: "Broiler Cobb 500 Plus",
      description: "Updated description",
      numberOfBirds: 55,
    }),
  });
  assert.equal(updatedBreed.status, 200);
  assert.equal(updatedBreed.body.data.name, "Broiler Cobb 500 Plus");

  // 8. Bird Condition & Health Tracking
  // Excessive birds in condition record (> breed.numberOfBirds = 55)
  const excessiveCondition = await request("/api/bird-conditions", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      houseId,
      breedId,
      healthy: 50,
      sick: 10, // 50 + 10 = 60 > 55
      weak: 0,
      underObservation: 0,
      recordDate: "2026-09-12",
    }),
  });
  assert.equal(excessiveCondition.status, 400);

  // Valid condition record
  const createdCondition = await request("/api/bird-conditions", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      houseId,
      breedId,
      healthy: 48,
      sick: 2,
      weak: 1,
      underObservation: 1,
      notes: "Flock is active, 2 birds isolated for mild sneezing",
      recordDate: "2026-09-12",
    }),
  });
  assert.equal(createdCondition.status, 201);
  const conditionId = createdCondition.body.data.id;
  assert.equal(createdCondition.body.data.healthy, 48);

  // User 2 cannot access condition record
  const user2GetCondition = await request(`/api/bird-conditions/${conditionId}`, {
    headers: authHeaders2,
  });
  assert.equal(user2GetCondition.status, 404);

  // 9. Expected Slaughter Date Planning
  // Slaughter date earlier than placement date rejected
  const invalidSlaughterDate = await request("/api/slaughter-plans", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      houseId,
      breedId,
      numberOfBirds: 20,
      placementDate: "2026-09-10",
      expectedSlaughterDate: "2026-09-05", // Earlier!
    }),
  });
  assert.equal(invalidSlaughterDate.status, 400);

  // Valid slaughter plan (Upcoming)
  const createdSlaughterPlan = await request("/api/slaughter-plans", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      houseId,
      breedId,
      numberOfBirds: 30,
      placementDate: "2026-09-10",
      expectedSlaughterDate: "2026-10-25",
      notes: "Batch ready for local market",
    }),
  });
  assert.equal(createdSlaughterPlan.status, 201);
  const planId = createdSlaughterPlan.body.data.id;
  assert.equal(createdSlaughterPlan.body.data.computedStatus, "Upcoming");

  // Toggle slaughter completed
  const completedPlan = await request(`/api/slaughter-plans/${planId}/complete`, {
    method: "PATCH",
    headers: authHeaders1,
    body: JSON.stringify({ completed: true }),
  });
  assert.equal(completedPlan.status, 200);
  assert.equal(completedPlan.body.data.status, "Completed");
  assert.equal(completedPlan.body.data.computedStatus, "Completed");

  // 10. Dashboard Aggregation
  const dashboard = await request(`/api/houses/${houseId}/dashboard`, {
    headers: authHeaders1,
  });
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.data.statistics.currentBirds, 97); // 100 - 3
  assert.equal(dashboard.body.data.statistics.totalBreeds, 1);
  assert.equal(dashboard.body.data.statistics.healthSummary.healthy, 48);
  assert.equal(dashboard.body.data.statistics.healthSummary.sick, 2);

  // User 2 cannot access User 1's dashboard
  const user2Dashboard = await request(`/api/houses/${houseId}/dashboard`, {
    headers: authHeaders2,
  });
  assert.equal(user2Dashboard.status, 404);

  // 11. Financial Management (Expenses, Income, Validation, Ownership, Reporting)
  // 11a. Invalid expense inputs
  const invalidExpenseAmount = await request("/api/expenses", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      amount: -100, // Invalid negative amount
      category: "Feed",
      date: "2026-09-18",
    }),
  });
  assert.equal(invalidExpenseAmount.status, 400);

  const invalidExpenseZero = await request("/api/expenses", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      amount: 0, // Must be > 0
      category: "Feed",
      date: "2026-09-18",
    }),
  });
  assert.equal(invalidExpenseZero.status, 400);

  const invalidExpenseDate = await request("/api/expenses", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      amount: 500,
      category: "Feed",
      date: "not-a-valid-date",
    }),
  });
  assert.equal(invalidExpenseDate.status, 400);

  // 11b. Tenant isolation: User 2 cannot create expense linked to User 1's house
  const user2HackedExpense = await request("/api/expenses", {
    method: "POST",
    headers: authHeaders2,
    body: JSON.stringify({
      houseId,
      amount: 1500,
      category: "Vaccines",
      date: "2026-09-18",
    }),
  });
  assert.equal(user2HackedExpense.status, 404);

  // 11c. User 1 creates valid expenses
  const createExpense1 = await request("/api/expenses", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      houseId,
      breedId,
      category: "Feed",
      amount: 12000,
      date: "2026-09-18",
      description: "Layer mash feed supply 50kg bags",
    }),
  });
  assert.equal(createExpense1.status, 201);
  assert.equal(createExpense1.body.data.amount, 12000);
  assert.equal(createExpense1.body.data.category, "Feed");
  const expenseId1 = createExpense1.body.data.id;

  const createExpense2 = await request("/api/expenses", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      category: "Electricity",
      amount: 3500,
      date: "2026-09-15",
      description: "Farm generator fuel and power",
    }),
  });
  assert.equal(createExpense2.status, 201);
  const expenseId2 = createExpense2.body.data.id;

  // 11d. User 1 creates valid income
  const createIncome1 = await request("/api/income", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      houseId,
      category: "Egg sales",
      amount: 25000,
      date: "2026-09-18",
      description: "50 crates sold to local supermarket",
    }),
  });
  assert.equal(createIncome1.status, 201);
  assert.equal(createIncome1.body.data.amount, 25000);
  assert.equal(createIncome1.body.data.category, "Egg sales");
  const incomeId1 = createIncome1.body.data.id;

  const createIncome2 = await request("/api/income", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      category: "Bird sales",
      amount: 15000,
      date: "2026-09-16",
      description: "Live broilers sold to wholesale buyers",
    }),
  });
  assert.equal(createIncome2.status, 201);
  const incomeId2 = createIncome2.body.data.id;

  // 11e. Tenant isolation: User 2 cannot access, update, or delete User 1's financial records
  const user2GetExp = await request(`/api/expenses/${expenseId1}`, { headers: authHeaders2 });
  assert.equal(user2GetExp.status, 404);

  const user2UpdateExp = await request(`/api/expenses/${expenseId1}`, {
    method: "PUT",
    headers: authHeaders2,
    body: JSON.stringify({
      category: "Feed",
      amount: 99999,
      date: "2026-09-18",
    }),
  });
  assert.equal(user2UpdateExp.status, 404);

  const user2DeleteExp = await request(`/api/expenses/${expenseId1}`, {
    method: "DELETE",
    headers: authHeaders2,
  });
  assert.equal(user2DeleteExp.status, 404);

  const user2GetInc = await request(`/api/income/${incomeId1}`, { headers: authHeaders2 });
  assert.equal(user2GetInc.status, 404);

  // 11f. User 1 updates expense and income
  const updateExp1 = await request(`/api/expenses/${expenseId1}`, {
    method: "PUT",
    headers: authHeaders1,
    body: JSON.stringify({
      houseId,
      breedId,
      category: "Feed",
      amount: 12500, // updated amount
      date: "2026-09-18",
      description: "Layer mash feed supply 50kg bags - updated",
    }),
  });
  assert.equal(updateExp1.status, 200);
  assert.equal(updateExp1.body.data.amount, 12500);

  const updateInc1 = await request(`/api/income/${incomeId1}`, {
    method: "PUT",
    headers: authHeaders1,
    body: JSON.stringify({
      houseId,
      category: "Egg sales",
      amount: 27500, // updated amount
      date: "2026-09-18",
      description: "55 crates sold to local supermarket",
    }),
  });
  assert.equal(updateInc1.status, 200);
  assert.equal(updateInc1.body.data.amount, 27500);

  // 11g. Financial summary calculation verification
  // Total Income: 27500 + 15000 = 42500
  // Total Expenses: 12500 + 3500 = 16000
  // Net Cash Flow: 42500 - 16000 = 26500
  const finSummary = await request("/api/financial-summary", { headers: authHeaders1 });
  assert.equal(finSummary.status, 200);
  assert.equal(finSummary.body.data.currency, "GMD");
  assert.equal(finSummary.body.data.totalIncome, 42500);
  assert.equal(finSummary.body.data.totalExpenses, 16000);
  assert.equal(finSummary.body.data.netCashFlow, 26500);
  assert.equal(finSummary.body.data.estimatedNet, 26500);

  // 11h. Financial transactions: Unified list, filtering, search
  const allTransactions = await request("/api/financial-transactions", { headers: authHeaders1 });
  assert.equal(allTransactions.status, 200);
  assert.equal(allTransactions.body.data.length, 4);

  const expenseOnly = await request("/api/financial-transactions?type=expense", { headers: authHeaders1 });
  assert.equal(expenseOnly.status, 200);
  assert.equal(expenseOnly.body.data.length, 2);
  assert.equal(expenseOnly.body.data.every((t) => t.type === "Expense"), true);

  const incomeOnly = await request("/api/financial-transactions?type=income", { headers: authHeaders1 });
  assert.equal(incomeOnly.status, 200);
  assert.equal(incomeOnly.body.data.length, 2);
  assert.equal(incomeOnly.body.data.every((t) => t.type === "Income"), true);

  const searchTransactions = await request("/api/financial-transactions?search=crates", { headers: authHeaders1 });
  assert.equal(searchTransactions.status, 200);
  assert.equal(searchTransactions.body.data.length, 1);
  assert.equal(searchTransactions.body.data[0].category, "Egg sales");

  // 11i. Financial Reports: Category breakdown and trends
  const reports = await request("/api/financial-reports", { headers: authHeaders1 });
  assert.equal(reports.status, 200);
  assert.equal(reports.body.data.totalIncome, 42500);
  assert.equal(reports.body.data.totalExpenses, 16000);
  assert.ok(reports.body.data.expenseBreakdown.some((c) => c.category === "Feed" && c.total === 12500));
  assert.ok(reports.body.data.incomeBreakdown.some((c) => c.category === "Egg sales" && c.total === 27500));

  // 11j. Delete financial records
  const delExp2 = await request(`/api/expenses/${expenseId2}`, {
    method: "DELETE",
    headers: authHeaders1,
  });
  assert.equal(delExp2.status, 200);

  const delInc2 = await request(`/api/income/${incomeId2}`, {
    method: "DELETE",
    headers: authHeaders1,
  });
  assert.equal(delInc2.status, 200);

  // =========================================================================
  // 12. PHASE 2: FARM BUSINESS FINANCE (Customers, Suppliers, Sales, Debts)
  // =========================================================================

  // 12a. Customer Management & Validation
  const createCustRes = await request("/api/customers", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      name: "ABC Shop",
      phone: "+220 712 3456",
      email: "contact@abcshop.gm",
      address: "Serrekunda Market",
      notes: "Daily egg retail partner",
    }),
  });
  assert.equal(createCustRes.status, 201);
  assert.equal(createCustRes.body.data.name, "ABC Shop");
  const customerId = createCustRes.body.data.id;

  // Tenant isolation: User 2 cannot view or edit User 1's customer
  const user2GetCust = await request(`/api/customers/${customerId}`, { headers: authHeaders2 });
  assert.equal(user2GetCust.status, 404);

  const user2UpdateCust = await request(`/api/customers/${customerId}`, {
    method: "PUT",
    headers: authHeaders2,
    body: JSON.stringify({ name: "Hacked Customer" }),
  });
  assert.equal(user2UpdateCust.status, 404);

  // 12b. Supplier Management & Validation
  const createSuppRes = await request("/api/suppliers", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      name: "ABC Feed Supplier",
      category: "Feed",
      phone: "+220 987 6543",
      email: "orders@abcfeed.gm",
      address: "Kanifing Industrial Estate",
      notes: "Weekly layer mash provider",
    }),
  });
  assert.equal(createSuppRes.status, 201);
  assert.equal(createSuppRes.body.data.name, "ABC Feed Supplier");
  const supplierId = createSuppRes.body.data.id;

  // Tenant isolation: User 2 cannot view or edit User 1's supplier
  const user2GetSupp = await request(`/api/suppliers/${supplierId}`, { headers: authHeaders2 });
  assert.equal(user2GetSupp.status, 404);

  // 12c. Scenario 1: Detailed Egg Sale with credit / outstanding balance
  // 20 trays x GMD 350 = GMD 7,000, Paid: GMD 5,000 -> Outstanding: GMD 2,000, Status: PARTIALLY_PAID
  const eggSaleRes = await request("/api/income", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      customerId,
      houseId,
      category: "Egg sales",
      quantity: 20,
      unit: "trays",
      unitPrice: 350,
      amount: 7000,
      amountPaid: 5000,
      date: "2026-09-19",
      description: "20 trays of fresh brown eggs",
    }),
  });
  assert.equal(eggSaleRes.status, 201);
  assert.equal(eggSaleRes.body.data.amount, 7000);
  assert.equal(eggSaleRes.body.data.amountPaid, 5000);
  assert.equal(eggSaleRes.body.data.amountDue, 2000);
  assert.equal(eggSaleRes.body.data.paymentStatus, "PARTIALLY_PAID");
  const eggSaleId = eggSaleRes.body.data.id;

  // 12d. Scenario 2: Dedicated Bird Sale fully paid (with auto-derived amount from quantity * unitPrice)
  // 25 birds x GMD 500 = GMD 12,500, Paid: GMD 12,500 -> Outstanding: GMD 0, Status: PAID
  const birdSaleRes = await request("/api/income", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      customerId,
      houseId,
      category: "Bird sales",
      quantity: 25,
      unit: "birds",
      unitPrice: 500,
      amountPaid: 12500,
      date: "2026-09-19",
      description: "25 dressed broilers",
    }),
  });
  assert.equal(birdSaleRes.status, 201);
  assert.equal(birdSaleRes.body.data.amount, 12500);
  assert.equal(birdSaleRes.body.data.amountPaid, 12500);
  assert.equal(birdSaleRes.body.data.amountDue, 0);
  assert.equal(birdSaleRes.body.data.paymentStatus, "PAID");
  const birdSaleId = birdSaleRes.body.data.id;

  // 12e. Scenario 3: Feed Purchase with supplier and payables owed
  // 50 bags x GMD 1,200 = GMD 60,000, Paid: GMD 40,000 -> Outstanding: GMD 20,000, Status: PARTIALLY_PAID
  const feedPurchaseRes = await request("/api/expenses", {
    method: "POST",
    headers: authHeaders1,
    body: JSON.stringify({
      supplierId,
      houseId,
      category: "Feed",
      quantity: 50,
      unit: "bags",
      unitPrice: 1200,
      amount: 60000,
      amountPaid: 40000,
      date: "2026-09-19",
      description: "50 bags layer feed",
    }),
  });
  assert.equal(feedPurchaseRes.status, 201);
  assert.equal(feedPurchaseRes.body.data.amount, 60000);
  assert.equal(feedPurchaseRes.body.data.amountPaid, 40000);
  assert.equal(feedPurchaseRes.body.data.amountDue, 20000);
  assert.equal(feedPurchaseRes.body.data.paymentStatus, "PARTIALLY_PAID");
  const feedPurchaseId = feedPurchaseRes.body.data.id;

  // 12f. Customer Financial Profile Verification
  // Total Purchases: 7,000 + 12,500 = 19,500
  // Total Paid: 5,000 + 12,500 = 17,500
  // Outstanding Debt: 2,000
  const custProfileRes = await request(`/api/customers/${customerId}`, { headers: authHeaders1 });
  assert.equal(custProfileRes.status, 200);
  assert.equal(custProfileRes.body.data.totalPurchases, 19500);
  assert.equal(custProfileRes.body.data.totalPaid, 17500);
  assert.equal(custProfileRes.body.data.outstandingBalance, 2000);
  assert.equal(custProfileRes.body.data.sales.length, 2);

  // 12g. Supplier Financial Profile Verification
  // Total Purchases: 60,000
  // Total Paid: 40,000
  // Outstanding Payables: 20,000
  const suppProfileRes = await request(`/api/suppliers/${supplierId}`, { headers: authHeaders1 });
  assert.equal(suppProfileRes.status, 200);
  assert.equal(suppProfileRes.body.data.totalPurchases, 60000);
  assert.equal(suppProfileRes.body.data.totalPaid, 40000);
  assert.equal(suppProfileRes.body.data.outstandingPayables, 20000);
  assert.equal(suppProfileRes.body.data.expenses.length, 1);

  // 12h. Enhanced Financial Summary Verification (Credit & Debt Tracking)
  const phase2Summary = await request("/api/financial-summary", { headers: authHeaders1 });
  assert.equal(phase2Summary.status, 200);
  assert.equal(phase2Summary.body.data.totalCustomerOutstanding, 2000);
  assert.equal(phase2Summary.body.data.totalSupplierOutstanding, 20000);
  assert.ok(phase2Summary.body.data.eggSalesTotal >= 7000);
  assert.ok(phase2Summary.body.data.birdSalesTotal >= 12500);
  assert.ok(phase2Summary.body.data.feedExpenseTotal >= 60000);

  // 12i. Enhanced Financial Reports Verification (Sales summaries, feed summary, debt lists)
  const phase2Reports = await request("/api/financial-reports?dateRange=month", { headers: authHeaders1 });
  assert.equal(phase2Reports.status, 200);
  assert.ok(phase2Reports.body.data.eggSalesSummary.totalRevenue >= 7000);
  assert.ok(phase2Reports.body.data.eggSalesSummary.totalQuantity >= 20);
  assert.ok(phase2Reports.body.data.birdSalesSummary.totalRevenue >= 12500);
  assert.ok(phase2Reports.body.data.birdSalesSummary.totalQuantity >= 25);
  assert.ok(phase2Reports.body.data.feedCostSummary.totalSpent >= 60000);
  assert.ok(phase2Reports.body.data.feedCostSummary.totalQuantity >= 50);
  assert.equal(phase2Reports.body.data.customerDebtSummary.totalOutstanding, 2000);
  assert.equal(phase2Reports.body.data.supplierPayablesSummary.totalOutstanding, 20000);

  // 12j. Unsettled Transactions Filter Verification
  const unsettledRes = await request("/api/financial-transactions?paymentStatus=UNSETTLED", { headers: authHeaders1 });
  assert.equal(unsettledRes.status, 200);
  assert.ok(unsettledRes.body.data.some((t) => t.id === eggSaleId));
  assert.ok(unsettledRes.body.data.some((t) => t.id === feedPurchaseId));

  // 12k. Clean up Phase 2 test entities
  await request(`/api/income/${eggSaleId}`, { method: "DELETE", headers: authHeaders1 });
  await request(`/api/income/${birdSaleId}`, { method: "DELETE", headers: authHeaders1 });
  await request(`/api/expenses/${feedPurchaseId}`, { method: "DELETE", headers: authHeaders1 });
  await request(`/api/customers/${customerId}`, { method: "DELETE", headers: authHeaders1 });
  await request(`/api/suppliers/${supplierId}`, { method: "DELETE", headers: authHeaders1 });

  // 12. Cleanup and Deletion
  const deletePlan = await request(`/api/slaughter-plans/${planId}`, {
    method: "DELETE",
    headers: authHeaders1,
  });
  assert.equal(deletePlan.status, 200);

  const deleteCondition = await request(`/api/bird-conditions/${conditionId}`, {
    method: "DELETE",
    headers: authHeaders1,
  });
  assert.equal(deleteCondition.status, 200);

  const deleteBreedRes = await request(`/api/breeds/${breedId}`, {
    method: "DELETE",
    headers: authHeaders1,
  });
  assert.equal(deleteBreedRes.status, 200);

  const deleteRecordRes = await request(`/api/daily-records/${recordId}`, {
    method: "DELETE",
    headers: authHeaders1,
  });
  assert.equal(deleteRecordRes.status, 200);

  const deleteHouseRes = await request(`/api/houses/${houseId}`, {
    method: "DELETE",
    headers: authHeaders1,
  });
  assert.equal(deleteHouseRes.status, 200);

  const missingHouse = await request(`/api/houses/${houseId}`, {
    headers: authHeaders1,
  });
  assert.equal(missingHouse.status, 404);
});