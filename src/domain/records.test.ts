import { describe, expect, it } from "vitest";
import { topRecords, type GameRecord } from "./records";

const records: GameRecord[] = [
  { id: "a", completedAt: "2026-01-01T00:00:00Z", mode: "solo", holes: 9, winner: "A", competitors: [{ name: "A", total: 25, scores: [3] }], lowestScore: 25 },
  { id: "b", completedAt: "2026-01-02T00:00:00Z", mode: "group", holes: 9, winner: "B", competitors: [{ name: "B", total: 21, scores: [2] }, { name: "C", total: 28, scores: [4] }], lowestScore: 21 },
  { id: "c", completedAt: "2026-01-03T00:00:00Z", mode: "solo", holes: 18, winner: "D", competitors: [{ name: "D", total: 49, scores: [3] }], lowestScore: 49 },
];

describe("Darty Golf records", () => {
  it("keeps best scores separate by round length", () => {
    expect(topRecords(records, 9).map((record) => record.id)).toEqual(["b", "a"]);
    expect(topRecords(records, 18).map((record) => record.id)).toEqual(["c"]);
  });

  it("limits leaderboards to five rounds", () => {
    expect(topRecords([...records, ...records.map((record, index) => ({ ...record, id: `copy-${index}` }))], 9, 2)).toHaveLength(2);
  });
});
