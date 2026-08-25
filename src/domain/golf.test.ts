import { describe, expect, it } from "vitest";
import { createGame, scoreHole, totalScore, winnerNames } from "./golf";

describe("Darty Golf rules", () => {
  it("records the selected final-dart result immediately", () => {
    let game = createGame("solo", ["Peter"]);
    game = scoreHole(game, 5);
    expect(game.competitors[0].scores[0]).toBe(5);
    expect(game.currentHole).toBe(2);
  });

  it("rotates group players and advances the hole", () => {
    let game = createGame("group", ["Red", "Blue"], 9);
    game = scoreHole(game, 3);
    expect(game.currentCompetitor).toBe(1);
    expect(game.currentHole).toBe(1);
    game = scoreHole(game, 4);
    expect(game.currentCompetitor).toBe(0);
    expect(game.currentHole).toBe(2);
  });

  it("calculates totals and winners", () => {
    let game = createGame("group", ["Red", "Blue"], 9);
    game = scoreHole(game, 2);
    game = scoreHole(game, 4);
    expect(totalScore(game.competitors[0])).toBe(2);
    expect(winnerNames(game)).toEqual(["Red"]);
  });

  it("completes the round after the final score", () => {
    let game = createGame("solo", ["Peter"], 9);
    for (let hole = 0; hole < 9; hole += 1) game = scoreHole(game, 3);
    expect(game.completedAt).not.toBeNull();
    expect(totalScore(game.competitors[0])).toBe(27);
  });
});
