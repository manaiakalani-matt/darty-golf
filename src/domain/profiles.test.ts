import { describe, expect, it } from "vitest";
import { buildProfiles, clubhouseRankings, headToHeadLine } from "./profiles";
import type { GameRecord } from "./records";

const round = (id: string, day: number, holes: 9 | 18, players: Array<[string, number[]]>): GameRecord => {
  const competitors = players.map(([name, scores]) => ({ name, scores, total: scores.reduce((a, b) => a + b, 0) }));
  return {
    id, completedAt: `2026-10-${String(day).padStart(2, "0")}T10:00:00Z`, holes, mode: players.length > 1 ? "group" : "solo",
    winner: "", competitors, lowestScore: Math.min(...competitors.map((c) => c.total)),
  };
};

const nine = (...scores: number[]) => scores;

const records: GameRecord[] = [
  round("r1", 1, 9, [["Daz", nine(1, 2, 3, 3, 3, 3, 3, 3, 3)], ["Darren", nine(3, 3, 3, 3, 3, 3, 3, 3, 7)]]),
  round("r2", 2, 9, [["daz", nine(3, 2, 3, 3, 3, 3, 3, 3, 3)], ["Darren", nine(2, 2, 3, 3, 3, 3, 3, 3, 3)]]),
  round("r3", 3, 9, [["Daz ", nine(3, 3, 3, 3, 3, 3, 3, 3, 3)], ["Darren", nine(3, 3, 3, 3, 3, 3, 3, 3, 3)], ["Zac", nine(7, 7, 7, 7, 7, 7, 7, 7, 7)]]),
  round("r4", 4, 9, [["Daz", nine(2, 2, 2, 2, 2, 2, 2, 2, 2)]]),
];

// These made-up players are all different people, so no nicknames apply.
const build = (list: GameRecord[]) => buildProfiles(list, {});
const profileOf = (name: string) => build(records).find((p) => p.key === name.toLowerCase())!;

describe("Player profiles", () => {
  it("merges the same name typed with different capitals or spaces", () => {
    const daz = profileOf("daz");
    expect(daz.roundsPlayed).toBe(4);
    expect(daz.name).toBe("Daz");
  });

  it("uses the club's nickname list by default", () => {
    const keys = buildProfiles([round("c", 5, 9, [["Dazza", nine(3, 3, 3, 3, 3, 3, 3, 3, 3)], ["Zaccyboi18", nine(3, 3, 3, 3, 3, 3, 3, 3, 3)]])]).map((p) => p.key);
    expect(keys).toEqual(["darren", "zac"]);
  });

  it("merges nicknames listed for the same person", () => {
    const merged = buildProfiles([
      round("a", 1, 9, [["Zaccyboi18", nine(3, 3, 3, 3, 3, 3, 3, 3, 3)]]),
      round("b", 2, 9, [["Zac", nine(2, 2, 2, 2, 2, 2, 2, 2, 2)], ["Daz", nine(3, 3, 3, 3, 3, 3, 3, 3, 3)]]),
    ], { zaccyboi18: "zac" });
    const zac = merged.find((p) => p.key === "zac")!;
    expect(merged.map((p) => p.key).sort()).toEqual(["daz", "zac"]);
    expect(zac.roundsPlayed).toBe(2);
    expect(zac.name).toBe("Zac");
    expect(merged.find((p) => p.key === "daz")!.headToHead[0].opponentKey).toBe("zac");
  });

  it("counts results, bests and wins", () => {
    const daz = profileOf("daz");
    expect(daz.holesInOne).toBe(1);
    expect(daz.birdies).toBe(11);
    expect(daz.best9?.recordId).toBe("r4");
    expect(daz.best9?.toPar).toBe(-9);
    expect(daz.best18).toBeNull();
    // Won r1 outright, lost r2, tied r3 with Darren: one win from three group rounds.
    expect(daz.wins).toBe(1);
    expect(daz.groupRounds).toBe(3);
  });

  it("finds the best and nemesis holes from holes played more than once", () => {
    const darren = profileOf("darren");
    expect(darren.bestHole).toEqual({ hole: 1, average: 2.7 });
    expect(darren.nemesisHole).toEqual({ hole: 9, average: 4.3 });
  });

  it("builds a form line of average strokes per hole, oldest first", () => {
    expect(profileOf("daz").form).toEqual([2.67, 2.89, 3, 2]);
  });

  it("keeps head-to-head records from shared rounds", () => {
    const daz = profileOf("daz");
    const vsDarren = daz.headToHead.find((h) => h.opponentKey === "darren")!;
    expect(vsDarren).toMatchObject({ wins: 1, losses: 1, ties: 1 });
    expect(headToHeadLine("Daz", vsDarren)).toBe("All square with Darren 1–1 (1 tied)");
    const vsZac = daz.headToHead.find((h) => h.opponentKey === "zac")!;
    expect(headToHeadLine("Daz", vsZac)).toBe("Daz leads Zac 1–0");
    expect(headToHeadLine("Zac", profileOf("zac").headToHead[0])).toMatch(/leads Zac 1–0$/);
  });

  it("ranks players with enough rounds by average per hole", () => {
    const { ranked, unranked } = clubhouseRankings(build(records));
    expect(ranked.map((p) => p.name)).toEqual(["Daz", "Darren"]);
    expect(unranked.map((p) => p.name)).toEqual(["Zac"]);
  });
});
