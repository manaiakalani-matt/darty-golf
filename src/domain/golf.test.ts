import { describe, expect, it } from "vitest";
import { bankScore, createGame, formatToPar, throwDart, totalScore, undoDart, winnerNames } from "./golf";

describe("Darty Golf rules", () => {
  it("only banks the last dart thrown", () => {
    let game = createGame("solo", ["Peter"]);
    game = throwDart(game, 2);
    game = throwDart(game, 5);
    game = bankScore(game);
    expect(game.competitors[0].scores[0]).toBe(5);
  });

  it("supports undo before a score is banked", () => {
    let game = createGame("solo", ["Peter"]);
    game = throwDart(throwDart(game, 3), 6);
    game = undoDart(game);
    expect(game.competitors[0].darts).toEqual([3]);
  });

  it("rotates teams and advances the hole", () => {
    let game = createGame("teams", ["Red", "Blue"], 9);
    game = bankScore(throwDart(game, 3));
    expect(game.currentCompetitor).toBe(1);
    expect(game.currentHole).toBe(1);
    game = bankScore(throwDart(game, 4));
    expect(game.currentCompetitor).toBe(0);
    expect(game.currentHole).toBe(2);
  });

  it("calculates totals, winners and golf notation", () => {
    let game = createGame("teams", ["Red", "Blue"], 9);
    game = bankScore(throwDart(game, 2));
    game = bankScore(throwDart(game, 4));
    expect(totalScore(game.competitors[0])).toBe(2);
    expect(winnerNames(game)).toEqual(["Red"]);
    expect(formatToPar(-1)).toBe("-1");
    expect(formatToPar(0)).toBe("E");
    expect(formatToPar(2)).toBe("+2");
  });
});
