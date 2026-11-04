// Copies every finished round from the original Google Sheets backend into the
// Cloudflare API, then checks each one arrived with the same scores.
//
//   TARGET_API_URL=https://darty-golf-api.<subdomain>.workers.dev npm run worker:import-sheets
//
// Safe to run more than once: rounds already copied are left unchanged.
import assert from "node:assert/strict";

const sourceApiUrl = process.env.SOURCE_API_URL
  ?? "https://script.google.com/macros/s/AKfycbx16vpj0FIFRm1fyBhA3x12RTO936-2oLBPXWsMdpwCbCoDg5OcSZ0xyY5Wp3TReCPxUw/exec";
const targetApiUrl = process.env.TARGET_API_URL;
assert(targetApiUrl, "TARGET_API_URL is required.");
assert.notEqual(targetApiUrl, sourceApiUrl, "Source and target must be different.");

const getRecords = async (url) => {
  const response = await fetch(`${url}?action=records`, { redirect: "follow" });
  const body = await response.json();
  assert(body.ok, `Could not read records from ${url}: ${body.message}`);
  return body.records;
};

// The Sheets records feed has no start time or player IDs, so those are filled in sensibly.
const toGame = (record) => ({
  id: record.id,
  mode: record.mode,
  holes: record.holes,
  createdAt: record.completedAt,
  completedAt: record.completedAt,
  competitors: record.competitors.map((competitor, index) => ({
    id: `imported-${index}`,
    name: competitor.name,
    scores: competitor.scores,
  })),
});

const sourceRecords = await getRecords(sourceApiUrl);
console.log(`Found ${sourceRecords.length} rounds in Google Sheets.`);

let created = 0;
for (const record of sourceRecords) {
  const response = await fetch(targetApiUrl, {
    method: "POST",
    headers: { "content-type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "saveGame", source: "sheets-import", game: toGame(record) }),
  });
  const body = await response.json();
  assert(body.ok, `Round ${record.id} (${record.winner}) was refused: ${body.message}`);
  if (body.created) created += 1;
}
console.log(`Copied ${created} new rounds (${sourceRecords.length - created} were already there).`);

const targetById = new Map((await getRecords(targetApiUrl)).map((record) => [record.id, record]));
for (const source of sourceRecords) {
  const target = targetById.get(source.id);
  assert(target, `Round ${source.id} is missing from Cloudflare.`);
  assert.equal(target.holes, source.holes, `Round ${source.id}: holes differ.`);
  assert.equal(target.mode, source.mode, `Round ${source.id}: mode differs.`);
  assert.equal(target.lowestScore, source.lowestScore, `Round ${source.id}: lowest score differs.`);
  assert.equal(target.winner, source.winner, `Round ${source.id}: winner differs.`);
  assert.deepEqual(
    target.competitors.map((c) => [c.name, c.scores]),
    source.competitors.map((c) => [c.name, c.scores]),
    `Round ${source.id}: player scores differ.`,
  );
}
console.log(`Verified all ${sourceRecords.length} rounds match hole-for-hole.`);
