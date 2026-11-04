import { describe, expect, it } from "vitest";
import { cleanGame, ValidationError, winnersOf } from "./validate";

const validGame = () => ({
  id: "abcd1234-ef56-4789-a012-3456789abcde",
  mode: "group",
  holes: 9,
  createdAt: "2026-11-04T01:00:00.000Z",
  completedAt: "2026-11-04T02:00:00.000Z",
  currentHole: 9,
  extraField: "should be dropped",
  competitors: [
    { id: "1", name: " Red ", scores: Array(9).fill(3) },
    { id: "2", name: "Blue", scores: Array(9).fill(4) },
  ],
});

const rejects = (game: unknown, message: string) => {
  expect(() => cleanGame(game)).toThrow(ValidationError);
  expect(() => cleanGame(game)).toThrow(message);
};

describe("API game checks", () => {
  it("accepts a real game and keeps only known fields", () => {
    const game = cleanGame(validGame());
    expect(game).not.toHaveProperty("extraField");
    expect(game).not.toHaveProperty("currentHole");
    expect(game.competitors[0].name).toBe("Red");
    expect(winnersOf(game)).toBe("Red");
  });

  it("reports ties the same way the Sheets backend did", () => {
    const game = validGame();
    game.competitors[1].scores = Array(9).fill(3);
    expect(winnersOf(cleanGame(game))).toBe("Red & Blue");
  });

  it("rejects impossible or tampered games", () => {
    rejects(null, "A completed Darty Golf game is required.");
    rejects({ ...validGame(), id: "=HACK()" }, "The game ID is not valid.");
    rejects({ ...validGame(), mode: "teams" }, "The game mode is not valid.");
    rejects({ ...validGame(), holes: 27 }, "A round must be 9 or 18 holes.");
    rejects({ ...validGame(), completedAt: "yesterday" }, "The finish time is not valid.");
    rejects({ ...validGame(), competitors: [] }, "A round needs 1 to 8 players.");
    rejects({ ...validGame(), mode: "solo" }, "A solo round has one player.");
  });

  it("rejects bad player data", () => {
    const base = validGame();
    rejects({ ...base, competitors: [base.competitors[0], { ...base.competitors[1], name: "red" }] }, "Player names must be different.");
    rejects({ ...base, competitors: [{ ...base.competitors[0], name: "x".repeat(29) }] }, "Each player needs a name of up to 28 characters.");
    rejects({ ...base, competitors: [{ ...base.competitors[0], scores: [3] }] }, "Every player needs a score for each hole.");
    for (const bad of [0, 8, 2.5, "3", null]) {
      rejects({ ...base, competitors: [{ ...base.competitors[0], scores: [bad, 3, 3, 3, 3, 3, 3, 3, 3] }] }, "Each hole score must be a whole number from 1 to 7.");
    }
  });
});
