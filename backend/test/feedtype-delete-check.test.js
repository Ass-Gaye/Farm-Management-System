const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const prisma = require("../src/lib/prisma");
const { app } = require("../src/server");

const email = "feedtype_delete_check@example.com";
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

test("feed type with history is permanently deleted", async () => {
  const reg = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password: "password123", name: "Del Check" }),
  });
  assert.equal(reg.status, 201);
  const h = { Authorization: `Bearer ${reg.body.data.token}` };

  // Feed type WITH history (opening stock creates a movement).
  const feed = await request("/api/feed-types", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ name: "Delete Me", unit: "kg", currentStock: 10 }),
  });
  assert.equal(feed.status, 201);

  // Blocked while stock remains: nothing is deleted.
  const blocked = await request(`/api/feed-types/${feed.body.data.id}`, {
    method: "DELETE",
    headers: h,
  });
  assert.equal(blocked.status, 400);
  const stillThere = await request(`/api/feed-types/${feed.body.data.id}`, { headers: h });
  assert.equal(stillThere.status, 200);

  // Zero the stock, then permanent delete succeeds.
  const zeroOut = await request("/api/inventory/adjust", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ feedTypeId: feed.body.data.id, type: "WASTAGE", quantity: -10, reason: "Clearing stock before delete" }),
  });
  assert.equal(zeroOut.status, 201);

  const del = await request(`/api/feed-types/${feed.body.data.id}`, {
    method: "DELETE",
    headers: h,
  });
  assert.equal(del.status, 200);

  const gone = await request(`/api/feed-types/${feed.body.data.id}`, { headers: h });
  assert.equal(gone.status, 404);

  const list = await request("/api/feed-types", { headers: h });
  assert.equal(list.body.data.some((f) => f.id === feed.body.data.id), false);
});
