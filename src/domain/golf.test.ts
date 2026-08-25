import { describe, expect, it } from "vitest";
import { createGame, createGameId, scoreHole, totalScore, undoLastScore, winnerNames } from "./golf";

describe("Darty Golf rules", () => {
  it("creates a game ID when randomUUID is unavailable", () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: {} });
    try {
      expect(createGameId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
      Object.defineProperty(globalThis, "crypto", { configurable: true, value: originalCrypto });
    }
  });

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

  it("undoes the previous player's score and returns to their turn", () => {
    let game = createGame("group", ["Red", "Blue"], 9);
    game = scoreHole(game, 3);
    game = scoreHole(game, 4);
    game = undoLastScore(game);
    expect(game.currentCompetitor).toBe(1);
    expect(game.currentHole).toBe(1);
    expect(game.competitors[1].scores[0]).toBeNull();
    game = undoLastScore(game);
    expect(game.currentCompetitor).toBe(0);
    expect(game.competitors[0].scores[0]).toBeNull();
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
