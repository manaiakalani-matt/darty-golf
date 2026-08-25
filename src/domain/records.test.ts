import { describe, expect, it } from "vitest";
import { bestRecord, recordedHoles, recordToPar, type GameRecord } from "./records";

const records: GameRecord[] = [
  { id: "a", completedAt: "2026-01-01T00:00:00Z", mode: "solo", holes: 9, winner: "A", competitors: [{ name: "A", total: 25 }], lowestScore: 25 },
  { id: "b", completedAt: "2026-01-02T00:00:00Z", mode: "teams", holes: 9, winner: "B", competitors: [{ name: "B", total: 21 }, { name: "C", total: 28 }], lowestScore: 21 },
  { id: "c", completedAt: "2026-01-03T00:00:00Z", mode: "solo", holes: 18, winner: "D", competitors: [{ name: "D", total: 49 }], lowestScore: 49 },
];

describe("Darty Golf records", () => {
  it("keeps best scores separate by round length", () => {
    expect(bestRecord(records, 9)?.id).toBe("b");
    expect(bestRecord(records, 18)?.id).toBe("c");
  });

  it("calculates record par and total competitor holes", () => {
    expect(recordToPar(records[1])).toBe(-6);
    expect(recordedHoles(records)).toBe(45);
  });
});
