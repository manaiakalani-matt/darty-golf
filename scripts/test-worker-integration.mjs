// End-to-end check of the Darty Golf Worker against a running instance.
// Local:  npm run worker:dev   (in another terminal), then npm run worker:test:integration
// Never point this at production: it saves a test round.
import assert from "node:assert/strict";

const apiUrl = process.env.API_BASE_URL ?? "http://localhost:8787";
assert(!apiUrl.includes("workers.dev"), "Refusing to run integration tests against the live API.");

const post = async (body, origin = "http://localhost:5173") => {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "content-type": "text/plain;charset=utf-8", origin },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json(), headers: response.headers };
};

const id = crypto.randomUUID();
const game = {
  id,
  mode: "group",
  holes: 9,
  createdAt: new Date(Date.now() - 600_000).toISOString(),
  completedAt: new Date().toISOString(),
  currentHole: 9,
  currentCompetitor: 0,
  competitors: [
    { id: "a", name: "Integration Red", scores: [1, 2, 3, 4, 5, 6, 7, 3, 3] },
    { id: "b", name: "Integration Blue", scores: [3, 3, 3, 3, 3, 3, 3, 3, 3] },
  ],
};

const first = await post({ action: "saveGame", game });
assert.equal(first.status, 200);
assert.deepEqual(first.body, { ok: true, created: true });
assert.equal(first.headers.get("access-control-allow-origin"), "http://localhost:5173");
console.log("✓ saves a valid round");

const again = await post({ action: "saveGame", game });
assert.deepEqual(again.body, { ok: true, created: false });
console.log("✓ saving the same round twice is harmless");

const bad = await post({ action: "saveGame", game: { ...game, id: crypto.randomUUID(), holes: 27 } });
assert.equal(bad.status, 400);
assert.equal(bad.body.message, "A round must be 9 or 18 holes.");
const junk = await post("not json");
assert.equal(junk.status, 400);
console.log("✓ rejects bad games and junk");

const stranger = await post({ action: "saveGame", game }, "https://evil.example");
assert.equal(stranger.headers.get("access-control-allow-origin"), null);
console.log("✓ other websites can't read responses in a browser");

const records = await (await fetch(`${apiUrl}?action=records`)).json();
const saved = records.records.find((record) => record.id === id);
assert(saved, "saved round appears in records");
assert.equal(saved.winner, "Integration Blue");
assert.equal(saved.lowestScore, 27);
assert.deepEqual(saved.competitors.map((c) => c.total), [34, 27]);
assert.equal(saved.holes, 9);
console.log("✓ records return the round with correct totals and winner");
console.log("All Worker integration checks passed.");
