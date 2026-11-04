import { describe, expect, it } from "vitest";
import { createGame, holeOutcome, isBackToBackAce, roundAwards, scoreHole, splitTotals, stakesLine, standings, type GolfGame, type Stroke } from "./golf";
import { assignColors, initialOf, PLAYER_COLORS } from "./players";

const play = (game: GolfGame, strokes: Stroke[]): GolfGame => strokes.reduce(scoreHole, game);

describe("Golf call-outs", () => {
  it("names every result on a par 3", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((s) => holeOutcome(s as Stroke).name)).toEqual([
      "Hole in one", "Birdie", "Par", "Bogey", "Double bogey", "Triple bogey", "Quadruple bogey",
    ]);
    expect(holeOutcome(1).tone).toBe("ace");
    expect(holeOutcome(7).tone).toBe("disaster");
  });
});

describe("Live standings", () => {
  it("orders by score to par and marks ties", () => {
    // Hole 1: Daz birdie, Darren par, Zac birdie. Hole 2: Daz par.
    const game = play(createGame("group", ["Daz", "Darren", "Zac"], 18), [2, 3, 2, 3]);
    const table = standings(game);
    expect(table.map((row) => [row.competitor.name, row.position, row.toPar, row.thru])).toEqual([
      ["Daz", "T1", -1, 2],
      ["Zac", "T1", -1, 1],
      ["Darren", "3", 0, 1],
    ]);
  });

  it("explains the stakes to the player about to throw", () => {
    const start = createGame("group", ["Daz", "Darren"], 18);
    expect(stakesLine(start, 0)).toBe("18 holes to play");
    const game = play(start, [2, 4]); // Daz -1, Darren +1
    expect(stakesLine(game, 0)).toBe("Leading by 2 with 17 to play");
    expect(stakesLine(game, 1)).toBe("2 behind Daz with 17 to play");
    expect(stakesLine(play(start, [3, 3]), 0)).toBe("Tied for the lead with 17 to play");
  });

  it("gives solo players their running score", () => {
    const game = play(createGame("solo", ["Matt"], 9), [2, 2]);
    expect(stakesLine(game, 0)).toBe("-2 with 7 to play");
  });
});

describe("Round awards", () => {
  it("hands out the awards people earned", () => {
    // 3 holes, 2 players: Daz 1,2,2  Zac 2,7,7
    let game = createGame("group", ["Daz", "Zac"], 9);
    game = play(game, [1, 2, 2, 7, 2, 7]);
    const awards = roundAwards(game);
    expect(awards).toEqual([
      { title: "Hole in one", winners: [], detail: "Daz on 1" },
      { title: "Most birdies", winners: ["Daz"], detail: "2 birdies" },
      { title: "Bounce-out champ", winners: ["Zac"], detail: "2 bounce-outs" },
    ]);
  });

  it("crowns the leader instead of listing them when holes in one are common", () => {
    // Daz: 1,1,1  Zac: 1,4,4
    const game = play(createGame("group", ["Daz", "Zac"], 9), [1, 1, 1, 4, 1, 4]);
    const award = roundAwards(game).find((entry) => entry.title === "Most holes in one");
    expect(award).toEqual({ title: "Most holes in one", winners: ["Daz"], detail: "3 holes in one" });
    expect(roundAwards(game).some((entry) => entry.title.startsWith("Hole"))).toBe(false);
  });

  it("spots back-to-back holes in one", () => {
    expect(isBackToBackAce([1, 1, null], 1)).toBe(true);
    expect(isBackToBackAce([4, 1, null], 1)).toBe(false);
    expect(isBackToBackAce([1, null], 0)).toBe(false);
  });

  it("skips an award when everyone ties for it", () => {
    const game = play(createGame("group", ["Daz", "Zac"], 9), [3, 3]);
    expect(roundAwards(game).map((award) => award.title)).toEqual([]);
  });
});

describe("Scorecard totals", () => {
  it("splits 18 holes into Out and In", () => {
    expect(splitTotals([...Array(9).fill(3), ...Array(9).fill(4)])).toEqual({ out: 27, in: 36 });
    expect(splitTotals(Array(9).fill(2))).toEqual({ out: 18, in: null });
  });
});

describe("Player colours", () => {
  it("gives the same name the same colour every night", () => {
    expect(assignColors(["Daz"])[0]).toBe(assignColors(["Daz", "Zac"])[0]);
    expect(assignColors(["daz "])[0]).toBe(assignColors(["Daz"])[0]);
  });

  it("never gives two players in one game the same colour", () => {
    const names = ["A", "B", "C", "D", "E", "F", "G", "H"];
    expect(new Set(assignColors(names).map((color) => color.id)).size).toBe(8);
  });

  it("keeps white text readable on every colour (WCAG AA)", () => {
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    for (const color of PLAYER_COLORS) {
      expect((1.05) / (luminance(color.fill) + 0.05), color.id).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("uses a capital initial", () => {
    expect(initialOf(" zac")).toBe("Z");
  });
});
